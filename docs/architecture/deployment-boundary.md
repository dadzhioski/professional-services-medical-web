# Web deployment boundary

| Concern | Web repository | API repository |
|---|---:|---:|
| Next.js image and lifecycle | Owns | Does not control |
| Caddy, TLS, ports 80/443 | Owns | No access |
| Shared edge network | Creates/joins as `web` | Joins as `api` |
| API image and lifecycle | No control | Owns |
| PostgreSQL, Flyway, backups | No access | Owns |

Caddy is the only public entry point. Web deployment credentials must not be capable of reading database secrets or operating the backend Compose project.
