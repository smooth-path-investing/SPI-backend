import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3000;

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Fresh TypeScript Node.js project is ready.",
      method: req.method,
      url: req.url
    })
  );
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
