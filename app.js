import express from "express";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
	res.json({ status: "ok", session: "NB6007CEM S2" });
});

app.listen(port, () => {
	console.log(`Hello world app listening on port ${port}`);
});

// testing preview deployment vercel