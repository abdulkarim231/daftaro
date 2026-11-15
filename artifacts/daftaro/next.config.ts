import type { NextConfig } from "next";

const configuredBasePath = process.env.BASE_PATH ?? "";
const basePath =
  configuredBasePath === "/"
    ? ""
    : configuredBasePath.replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  output: "export",
};

export default nextConfig;
