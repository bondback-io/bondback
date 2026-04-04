import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "emails");
const oldLine = 'const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";';

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      if (!c.includes(oldLine) || c.includes("email-public-url")) continue;
      const imp = path.dirname(p).endsWith("components") ? "../email-public-url" : "./email-public-url";
      const importLine = `import { emailPublicOrigin } from "${imp}";\n`;
      if (c.includes('import * as React from "react";')) {
        c = c.replace('import * as React from "react";\n', `import * as React from "react";\n${importLine}`);
      } else {
        c = importLine + c;
      }
      c = c.replace(oldLine, "const APP_URL = emailPublicOrigin();");
      fs.writeFileSync(p, c);
      console.log("patched", path.relative(root, p));
    }
  }
}

walk(root);
