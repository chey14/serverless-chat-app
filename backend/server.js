const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Chat backend running 🚀");
});

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
