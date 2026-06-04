import mongoose from "mongoose";

/**
 * Handles MUI DataGrid Quick Filter (search)
 */
export const handleSearch = (search, searchFields) => {
  if (!search || !search.trim()) return null;

  const searchTerms = search
    .trim()
    .split(/\s+/)
    .map((s) => new RegExp(s, "i"));
  const conditions = [];

  searchTerms.forEach((term) => {
    conditions.push({
      $or: searchFields.map((field) => ({ [field]: term })),
    });
  });

  return { $and: conditions };
};

/**
 * Handles MUI DataGrid Filter Model with support for relation field sub-queries
 */
export const handleFilter = async (
  filterModel,
  stringFields,
  relationFields = {},
) => {
  if (!filterModel) return null;

  try {
    const parsedFilter =
      typeof filterModel === "string" ? JSON.parse(filterModel) : filterModel;
    const items = Array.isArray(parsedFilter.items)
      ? parsedFilter.items
      : Object.values(parsedFilter.items || {});
    const logic = parsedFilter.logicOperator === "or" ? "$or" : "$and";

    if (items.length === 0) return null;

    const filterConditions = [];

    for (const item of items) {
      if (
        item.value !== undefined &&
        item.value !== null &&
        item.value !== ""
      ) {
        const field = item.field;
        const operator = item.operator;
        const value = item.value;
        const condition = {};

        const isStringField = stringFields.includes(field);
        const relationConfig = relationFields[field];

        // Handle Relation Field Sub-queries (if value is a search term and not an ID)
        if (
          relationConfig &&
          operator === "contains" &&
          typeof value === "string" &&
          !value.match(/^[0-9a-fA-F]{24}$/)
        ) {
          try {
            const RelatedModel = mongoose.model(relationConfig.model);
            const relatedDocs = await RelatedModel.find({
              [relationConfig.searchField]: { $regex: value, $options: "i" },
            }).select("_id");

            const ids = relatedDocs.map((d) => d._id);
            condition[field] = ids.length > 0 ? { $in: ids } : { $in: [] };
          } catch (err) {
            console.error(`Sub-query error for field ${field}:`, err);
          }
        }
        // Handle Standard Fields
        else {
          switch (operator) {
            case "contains":
              if (isStringField) {
                condition[field] = { $regex: value, $options: "i" };
              } else if (relationConfig && value.match(/^[0-9a-fA-F]{24}$/)) {
                condition[field] = value;
              }
              break;
            case "equals":
            case "is":
              condition[field] = value;
              break;
            case "startsWith":
              if (isStringField) {
                condition[field] = { $regex: `^${value}`, $options: "i" };
              }
              break;
            case "endsWith":
              if (isStringField) {
                condition[field] = { $regex: `${value}$`, $options: "i" };
              }
              break;
            case "isAnyOf":
              condition[field] = { $in: Array.isArray(value) ? value : [value] };
              break;
            case "not":
              condition[field] = { $ne: value };
              break;
            case "after":
              condition[field] = { $gt: new Date(value) };
              break;
            case "onOrAfter":
              condition[field] = { $gte: new Date(value) };
              break;
            case "before":
              condition[field] = { $lt: new Date(value) };
              break;
            case "onOrBefore":
              condition[field] = { $lte: new Date(value) };
              break;
          }
        }

        if (Object.keys(condition).length > 0) {
          filterConditions.push(condition);
        }
      }
    }

    return filterConditions.length > 0 ? { [logic]: filterConditions } : null;
  } catch (e) {
    console.error("Filter handler error:", e);
    return null;
  }
};

/**
 * Handles MUI DataGrid Sort Model
 */
export const handleSort = (sortModel, defaultSort = { createdAt: -1 }) => {
  if (!sortModel) return defaultSort;

  try {
    const parsedSort =
      typeof sortModel === "string" ? JSON.parse(sortModel) : sortModel;
    const sortItems = Array.isArray(parsedSort)
      ? parsedSort
      : Object.values(parsedSort || {});

    if (sortItems.length > 0) {
      const sort = {};
      sortItems.forEach((s) => {
        if (s.field && s.sort) {
          sort[s.field] = s.sort === "asc" ? 1 : -1;
        }
      });
      return sort;
    }
  } catch (e) {
    console.error("Sort handler error:", e);
  }

  return defaultSort;
};

/**
 * Handles MUI DataGrid Pagination (page/pageSize or offset/limit)
 */
export const handlePagination = (reqQuery) => {
  const { page = 0, pageSize = 25, offset, limit } = reqQuery;
  const skip = offset ? parseInt(offset) : parseInt(page) * parseInt(pageSize);
  const finalLimit = limit ? parseInt(limit) : parseInt(pageSize);

  return { skip, limit: finalLimit };
};

/**
 * Handles MUI DataGrid Server-Side Grouping using MongoDB Aggregation
 * Supports relational lookups and hierarchical drill-downs
 */
export const handleGrouping = async ({
  Model,
  mongoQuery,
  groupFields = [],
  groupKeys = [],
  sortModel = [],
  relationFields = {},
}) => {
  if (!groupFields || groupFields.length === 0) return null;

  const pipeline = [];

  // 1. Initial Match (Standard mongoQuery hooks: search & direct filters)
  pipeline.push({ $match: mongoQuery });

  // 2. Map Lookups for any relational fields being grouped or sorted
  const needsLookup = new Set();
  const parsedSortModel =
    typeof sortModel === "string" ? JSON.parse(sortModel) : sortModel;

  [...groupFields, ...parsedSortModel.map((s) => s.field)].forEach((field) => {
    if (relationFields[field]) {
      needsLookup.add(field);
    }
  });

  for (const field of needsLookup) {
    const config = relationFields[field];
    try {
      const RelatedModel = mongoose.model(config.model);
      const collectionName = RelatedModel.collection.name;

      pipeline.push({
        $lookup: {
          from: collectionName,
          localField: field,
          foreignField: "_id",
          as: `${field}_doc`,
        },
      });
      pipeline.push({
        $unwind: { path: `$${field}_doc`, preserveNullAndEmptyArrays: true },
      });
    } catch (e) {
      console.error(`Error looking up relation ${field}:`, e);
    }
  }

  // 3. Drill down by groupKeys (Filtering deeper branches in the tree)
  for (let i = 0; i < groupKeys.length; i++) {
    const field = groupFields[i];
    const key = groupKeys[i];

    let matchField = field;
    if (relationFields[field]) {
      matchField = `${field}_doc.${relationFields[field].searchField}`;
    }

    // Exact case-insensitive match for reliable grouping path tracing
    pipeline.push({
      $match: {
        [matchField]: { $regex: `^${key}$`, $options: "i" },
      },
    });
  }

  // 4. Group outputs vs Leaf outputs
  if (groupKeys.length < groupFields.length) {
    // Returning Aggregated Groups (Intermediate level)
    const currentField = groupFields[groupKeys.length];
    let groupByKey = `$${currentField}`;
    if (relationFields[currentField]) {
      groupByKey = `$${currentField}_doc.${relationFields[currentField].searchField}`;
    }

    pipeline.push({
      $group: {
        _id: { $ifNull: [groupByKey, ""] },
        descendantCount: { $sum: 1 },
      },
    });

    // Apply Group Sorting
    const sortRule = parsedSortModel.find(
      (item) => item.field === currentField,
    );
    pipeline.push({
      $sort: { _id: sortRule?.sort === "desc" ? -1 : 1 },
    });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $match: {} }], // Global fetch for groups
      },
    });

    const [aggregationResult] = await Model.aggregate(pipeline);
    const totalCount = aggregationResult?.metadata?.[0]?.total || 0;
    const paginatedGroups = aggregationResult?.data || [];

    const rows = paginatedGroups.map((g) => {
      const pathKey = [...groupKeys, g._id].join("-");
      const rowObj = {
        id: `auto-generated-parent-${pathKey}`,
        group: g._id,
        descendantCount: g.descendantCount,
        [currentField]: g._id,
      };
      // Inject previous group keys
      groupKeys.forEach((k, i) => {
        rowObj[groupFields[i]] = k;
      });
      return rowObj;
    });

    return { rows, rowCount: totalCount };
  } else {
    // Returning End Leaf Nodes (Final level)
    const sortStage = {};
    if (parsedSortModel.length > 0) {
      for (const s of parsedSortModel) {
        let sortField = s.field;
        if (relationFields[s.field]) {
          sortField = `${s.field}_doc.${relationFields[s.field].searchField}`;
        }
        sortStage[sortField] = s.sort === "asc" ? 1 : -1;
      }
    } else {
      sortStage["createdAt"] = -1;
    }
    pipeline.push({ $sort: sortStage });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $project: { _id: 1 } }],
      },
    });

    const [aggregationResult] = await Model.aggregate(pipeline);
    const totalCount = aggregationResult?.metadata?.[0]?.total || 0;
    const paginatedIds = aggregationResult?.data?.map((d) => d._id) || [];

    return { leafIds: paginatedIds, rowCount: totalCount };
  }
};
