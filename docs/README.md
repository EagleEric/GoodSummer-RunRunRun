# GitHub Pages 刷题版

这个目录是专门给 GitHub Pages 使用的静态网页版。

上传到 GitHub 后，在仓库的 `Settings -> Pages` 中选择：

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

题库文件放在：

```text
docs/banks
```

如果以后新增或修改题库，更新这里的 `.txt` 文件即可。若新增了新的题库文件名，还需要在 `docs/app.js` 顶部的 `BANK_FILES` 列表中加上文件名。

这个版本不使用服务器数据库，账号、错题集、进度保存在每个使用者自己的浏览器中。
