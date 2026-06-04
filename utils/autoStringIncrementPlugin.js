import Counter from "../api/others/counter.model.js";

function autoStringIncrementPlugin(schema, options) {
  const { model, field, prefix = "", padLength = 5 } = options;

  schema.pre("validate", async function () {
    try {
      if (!this.isNew) return;
      const key = `${model}-${field}`;

      const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      );

      this.AutoID = String(counter.count);

      if (this[field]) return;

      // Use the prefix from the document if present, else use default prefix
      const docprefix = this.prefix || prefix;

      const paddedNumber = String(counter.count).padStart(padLength, "0");
      this[field] = `${docprefix}-${paddedNumber}`; // e.g. PUN-00001
    } catch (err) {
      throw err;
    }
  });
}

export default autoStringIncrementPlugin;
