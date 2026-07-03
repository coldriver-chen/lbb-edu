import { defineAction } from "astro:actions";
import { z } from 'astro/zod'

export const server = {
  uploadPdf: defineAction({
    accept: "form",
    input: z.object({
      admin_token: z.string().min(1), // 注意这个token不是github的token
      path: z.string().min(1),
      file: z.instanceof(File),
    }),
    handler: async ({ path, file, admin_token }) => {
      const owner = import.meta.env.GITHUB_OWNER;
      const repo = import.meta.env.GITHUB_REPO;
      const branch = import.meta.env.GITHUB_BRANCH || "main";
      const token = import.meta.env.GITHUB_PAT_TOKEN;
      const rightAdminToken = import.meta.env.ADMIN_TOKEN;
      
      if (admin_token !== rightAdminToken) {
        return {
          success: false,
          message: "Admin token is incorrect.",
        }
      }
      
      // 读取文件
      const buffer = Buffer.from(await file.arrayBuffer());
      const content = buffer.toString("base64");

      const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
        path
      ).replace(/%2F/g, "/")}`;

      // 查询文件是否存在（更新时需要 sha）
      const getResp = await fetch(api, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      let sha: string | undefined;

      if (getResp.ok) {
        const data = await getResp.json();
        sha = data.sha;
      } else if (getResp.status !== 404) {
        return {
          success: false,
          message: "Failed to query existing file.",
        }
      }

      // 创建或更新
      const putResp = await fetch(api, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `${sha ? "Update" : "Upload"} ${path}`,
          content,
          branch,
          ...(sha ? { sha } : {}),
        }),
      });

      if (!putResp.ok) {
        const err = await putResp.text();
        return {
          success: false,
          message: err,
        }
      }

      const result = await putResp.json();

      return {
        success: true,
        path,
        url: result.content.html_url,
      };
    },
  }),
};