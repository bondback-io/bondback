import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "emails");

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      if (!c.includes("emailPublicOrigin()") || c.includes("email-public-url")) continue;
      const imp = path.dirname(p).endsWith("components") ? "../email-public-url" : "./email-public-url";
      const line = `import { emailPublicOrigin } from "${imp}";\n`;
      if (c.includes('import { EmailLayout } from "./components/EmailLayout";')) {
        c = c.replace(
          'import { EmailLayout } from "./components/EmailLayout";\n',
          `import { EmailLayout } from "./components/EmailLayout";\n${line}`
        );
      } else if (c.includes('import { Section, Text } from "@react-email/components";')) {
        c = c.replace(
          'import { Section, Text } from "@react-email/components";\n',
          `import { Section, Text } from "@react-email/components";\n${line}`
        );
      } else {
        c = c.replace('import * as React from "react";\n', `import * as React from "react";\n${line}`);
      }
      fs.writeFileSync(p, c);
      console.log("fixed", path.relative(root, p));
    }
  }
}

walk(root);
