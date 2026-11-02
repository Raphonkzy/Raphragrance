import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    ignores: [
      "scripts/**",
      "reports/**",
      "fixtures/**",
      "tests/**",
      "node_modules/**",
      ".next/**",
    ],
  },
];

export default config;
