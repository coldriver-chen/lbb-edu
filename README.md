文献阅读 PDF 或其他文档按类别放在以下目录：

- `public\literatures\光纤仿生传感`
- `public\literatures\光纤生物医学传感`
- `public\literatures\其他交叉领域`

组会记录文档放在以下目录：

- `public\group-meetings\正式组会`
- `public\group-meetings\自主组会\光纤仿生传感`
- `public\group-meetings\自主组会\其他交叉领域`

文献阅读和组会记录页面会自动读取对应文件夹中的文档，并在文档名称后显示添加日期。

后台上传文档：

1. 运行 `bun run admin`
2. 打开 `http://127.0.0.1:4322/admin`
3. 默认账号：`admin`
4. 默认密码：`admin123456`

可以用环境变量修改后台账号密码：

```powershell
$env:ADMIN_USER='admin'
$env:ADMIN_PASSWORD='你的新密码'
bun run admin
```

上传后的文件会直接保存到对应的 `public` 目录。上传后如果线上页面没有立即变化，需要重新构建并发布网站。

`学术资讯`内容修改 `src\content\academic-news.mdx`

`课题组新闻`内容修改 `src\content\group-news.mdx`

`个人简介`内容修改 `src\content\profile.mdx`

`研究方向`内容修改 `src\content\research.mdx`

`相关教师`修改 `src\data\related-teachers.json` 中的信息，及其 `public\related-teachers` 的图片

教师 Hero 部分的简介内容修改 `src\data\teacher-info.json`
