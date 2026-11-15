import type { NextConfig } from "next";

const configuredBasePath = process.env.BASE_PATH ?? "";
const basePath =
  configuredBasePath === "/"
    ? ""
    : configuredBasePath.replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  output: "export",
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
