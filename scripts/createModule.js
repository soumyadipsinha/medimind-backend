#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Directory where npm command was executed
const baseDir = process.env.INIT_CWD || process.cwd();

/**
 * kebab-case / snake_case → camelCase
 * master-tags -> masterTags
 */
const toCamelCase = (str) =>
    str
        .toLowerCase()
        .replace(/[-_]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ""));

/**
 * kebab-case / snake_case → PascalCase
 * master-tags -> MasterTags
 */
const toPascalCase = (str) => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const askModuleName = () =>
    new Promise((resolve) => {
        rl.question("Enter module name: ", (answer) => {
            resolve(answer.trim());
        });
    });

const createModule = (moduleName) => {
    if (!moduleName) {
        console.error("❌ Module name cannot be empty.");
        process.exit(1);
    }

    const modulePath = path.join(baseDir, moduleName);

    if (fs.existsSync(modulePath)) {
        console.error(`❌ Module "${moduleName}" already exists.`);
        process.exit(1);
    }

    fs.mkdirSync(modulePath, { recursive: true });

    const camelModule = toCamelCase(moduleName);
    const pascalModule = toPascalCase(moduleName);

    /* ---------- controller ---------- */
    fs.writeFileSync(
        path.join(modulePath, `${moduleName}.controller.js`),
        `import ${pascalModule} from "./${moduleName}.model.js";\n 
    
export async function getAll${pascalModule}s(req, res) {

    const ${camelModule}s = await ${pascalModule}.find({});
    res.json(${camelModule}s);
}\n`
    );

    /* ---------- model (mongoose boilerplate) ---------- */
    fs.writeFileSync(
        path.join(modulePath, `${moduleName}.model.js`),
        `import mongoose from "mongoose";

const ${pascalModule}Schema = new mongoose.Schema(
  {
    // TODO: define schema fields
  },
  {
    timestamps: true,
  }
);

const ${pascalModule} = mongoose.model("${pascalModule}", ${pascalModule}Schema);

export default ${pascalModule};
`
    );

    /* ---------- router ---------- */
    fs.writeFileSync(
        path.join(modulePath, `${moduleName}.route.js`),
        `import express from "express";
import {
    getAll${pascalModule}s
} from "./${moduleName}.controller.js";

const ${camelModule}Router = express.Router();

// Define your routes here
${camelModule}Router.get("/", getAll${pascalModule}s);

export default ${camelModule}Router;
`
    );

    console.log(`✅ Module "${moduleName}" created in ${baseDir}`);
};

(async () => {
    const moduleName = await askModuleName();
    rl.close();
    createModule(moduleName);
})();
