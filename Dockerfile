FROM alpine:3.22 AS prepare
WORKDIR /src
COPY . .
RUN set -eux; \
    if [ -f dist/index.html ]; then cp -a dist /site; \
    elif [ -f brume.zip ]; then mkdir /release; unzip -q brume.zip -d /release; mv /release/dist /site; \
    else echo "Import brume.zip or the complete dist directory before deploying" >&2; exit 1; fi; \
    test -s /site/index.html; \
    test -s /site/editor.mjs; \
    test -s /site/environment.mjs; \
    test -s /site/vendor/three.module.min.js; \
    test -d /site/assets/materials; \
    test -d /site/assets/kenney
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=prepare /site/ /srv/
EXPOSE 8080
