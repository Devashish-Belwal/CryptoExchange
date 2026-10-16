import dotenv from "dotenv";
dotenv.config();

const envConfig = {
    PORT: process.env.WS_PORT ? Number(process.env.WS_PORT) : 8083,
}

export default envConfig;
