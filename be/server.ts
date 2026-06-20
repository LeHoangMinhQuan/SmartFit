import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();

// Start the server
const port:number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(port, "0.0.0.0", (error?: Error) => {
  if (error) {
    throw error;
  }

  console.log(`Server running on port ${port}`);
});