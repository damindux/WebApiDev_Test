import express from "express";
import registerRoutes from "./routes.js";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
	res.json({ status: "ok", session: "NB6007CEM S2" });
});

registerRoutes(app);

app.listen(port, () => {
	console.log(`Hello world app listening on port ${port}`);
});