# tonitalej.github.io

Source of my personal site, [tonitalej.github.io](https://tonitalej.github.io/).

Built with [Hugo](https://gohugo.io/) and a hand-made theme (no frameworks, trackers or external fonts), and
deployed to GitHub Pages by GitHub Actions on every push to `main`.

## Edit the content

| What | Where |
| --- | --- |
| Name, role, email, links | `hugo.toml` → `[params]` |
| Skills | `data/skills.yaml` |
| Projects (with live GitHub stars and last update) | `data/projects.yaml` |
| Journey timeline | `data/journey.yaml` |
| Social links | `data/socials.yaml` |
| Blog posts | `content/blog/*.md` (`hugo new content blog/my-post.md`) |
| Photos | `assets/images/` |

## Run locally

```sh
hugo server
```

Then open http://localhost:1313. Requires Hugo extended 0.146 or newer (CI uses 0.156.0).
