import app from "./app.js";
import { env } from "./config/env.js";


// Start the server
const port:number = env.PORT ?? 3000;

app.listen(port, "0.0.0.0", (error?: Error) => {
  if (error) {
    throw error;
  }

  console.log(`Server running on port ${port}`);
});