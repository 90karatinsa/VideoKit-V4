Last login: Tue Sep 16 13:29:51 on ttys000
borayunusoglu@Bora-MacBook-Pro ~ % cd "/Users/borayunusoglu/Desktop/Proje 2/"

borayunusoglu@Bora-MacBook-Pro Proje 2 % setopt interactivecomments

borayunusoglu@Bora-MacBook-Pro Proje 2 % docker-compose up --build
[+] Building 29.0s (15/15) FINISHED                                             
 => [internal] load local bake definitions                                 0.0s
 => => reading from stdin 518B                                             0.0s
 => [internal] load build definition from Dockerfile.server                0.0s
 => => transferring dockerfile: 437B                                       0.0s
 => [internal] load metadata for docker.io/library/node:22-bookworm-slim   1.3s
 => [auth] library/node:pull token for registry-1.docker.io                0.0s
 => [internal] load .dockerignore                                          0.0s
 => => transferring context: 369B                                          0.0s
 => [internal] load build context                                          0.0s
 => => transferring context: 7.32kB                                        0.0s
 => [1/7] FROM docker.io/library/node:22-bookworm-slim@sha256:4a4884e8a44  0.0s
 => => resolve docker.io/library/node:22-bookworm-slim@sha256:4a4884e8a44  0.0s
 => CACHED [2/7] WORKDIR /usr/src/app                                      0.0s
 => CACHED [3/7] RUN apt-get update &&     apt-get install -y --no-instal  0.0s
 => [4/7] COPY package*.json ./                                            0.0s
 => [5/7] RUN npm ci --omit=dev                                           15.6s
 => [6/7] COPY . .                                                         0.2s 
 => [7/7] RUN chmod +x /usr/src/app/entrypoint.sh                          0.1s 
 => exporting to image                                                    11.4s 
 => => exporting layers                                                    7.2s 
 => => exporting manifest sha256:683e33fa008abf939ab2726845322375aa659467  0.0s 
 => => exporting config sha256:02173cd2fc32a06364c3ba0afea92b5cb30282450b  0.0s 
 => => exporting attestation manifest sha256:ae980502afe138dfbb4a34fe6e6b  0.0s
 => => exporting manifest list sha256:e668da691be069cdba6e3c03fb1aa50327e  0.0s
 => => naming to docker.io/library/proje2-api:latest                       0.0s
 => => unpacking to docker.io/library/proje2-api:latest                    4.2s
 => resolving provenance for metadata file                                 0.0s
[+] Running 2/2
 ✔ proje2-api              Built                                           0.0s 
 ✔ Container proje2-api-1  Recreated                                       0.9s 
Attaching to api-1, videokit_postgres, videokit_redis
videokit_redis  | 1:C 16 Sep 2025 11:08:28.814 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo
videokit_redis  | 1:C 16 Sep 2025 11:08:28.814 * Redis version=7.4.5, bits=64, commit=00000000, modified=0, pid=1, just started
videokit_redis  | 1:C 16 Sep 2025 11:08:28.814 # Warning: no config file specified, using the default config. In order to specify a config file use redis-server /path/to/redis.conf
videokit_redis  | 1:M 16 Sep 2025 11:08:28.814 * monotonic clock: POSIX clock_gettime
videokit_redis  | 1:M 16 Sep 2025 11:08:28.816 * Running mode=standalone, port=6379.
videokit_redis  | 1:M 16 Sep 2025 11:08:28.816 * Server initialized
videokit_redis  | 1:M 16 Sep 2025 11:08:28.818 * Loading RDB produced by version 7.4.5
videokit_redis  | 1:M 16 Sep 2025 11:08:28.818 * RDB age 483 seconds
videokit_redis  | 1:M 16 Sep 2025 11:08:28.818 * RDB memory usage when created 0.96 Mb
videokit_redis  | 1:M 16 Sep 2025 11:08:28.818 * Done loading RDB, keys loaded: 0, keys expired: 0.
videokit_redis  | 1:M 16 Sep 2025 11:08:28.818 * DB loaded from disk: 0.002 seconds
videokit_redis  | 1:M 16 Sep 2025 11:08:28.819 * Ready to accept connections tcp
videokit_postgres  | 
videokit_postgres  | PostgreSQL Database directory appears to contain a database; Skipping initialization
videokit_postgres  | 
videokit_postgres  | 2025-09-16 11:08:28.861 UTC [1] LOG:  starting PostgreSQL 15.14 on aarch64-unknown-linux-musl, compiled by gcc (Alpine 14.2.0) 14.2.0, 64-bit
videokit_postgres  | 2025-09-16 11:08:28.861 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
videokit_postgres  | 2025-09-16 11:08:28.862 UTC [1] LOG:  listening on IPv6 address "::", port 5432
videokit_postgres  | 2025-09-16 11:08:28.865 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
videokit_postgres  | 2025-09-16 11:08:28.871 UTC [29] LOG:  database system was shut down at 2025-09-16 11:00:25 UTC
videokit_postgres  | 2025-09-16 11:08:28.878 UTC [1] LOG:  database system is ready to accept connections
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations...
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
videokit_postgres  | 2025-09-16 11:13:28.975 UTC [27] LOG:  checkpoint starting: time
videokit_postgres  | 2025-09-16 11:13:28.990 UTC [27] LOG:  checkpoint complete: wrote 3 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.007 s, sync=0.002 s, total=0.016 s; sync files=2, longest=0.001 s, average=0.001 s; distance=0 kB, estimate=0 kB
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)
api-1              | Waiting for PostgreSQL to be ready...
api-1              | PostgreSQL is up - executing command
api-1              | Running database migrations... Watch
api-1              | 
api-1              | > videokit-api@1.0.0 migrate
api-1              | > node-pg-migrate up
api-1              | 
api-1              | No migrations to run!
api-1              | Migrations complete!
api-1              | Migrations complete!
api-1              | Starting application...
api-1              | file:///usr/src/app/server.mjs:14
api-1              | import express from 'express';
api-1              |        ^^^^^^^
api-1              | 
api-1              | SyntaxError: Unexpected identifier 'express'
api-1              |     at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
api-1              |     at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:107:18)
api-1              |     at #translate (node:internal/modules/esm/loader:540:12)
api-1              |     at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:587:27)
api-1              |     at async ModuleJob._link (node:internal/modules/esm/module_job:162:19)
api-1              | 
api-1              | Node.js v22.19.0
api-1 exited with code 1 (restarting)


v View in Docker Desktop   o View Config   w Enable Watch
