/**
 * Vite config para desenvolvimento local apontando para produção.
 *
 * USO:
 *   PRODUCTION_URL=https://atendimento.amelingerie.com node ./node_modules/vite/bin/vite.js --config vite.localdev.config.mts
 *
 * AUTENTICAÇÃO:
 *   1. Abra a produção no navegador → DevTools → Application → Cookies
 *   2. Copie o valor do cookie `cw_d_session_info`
 *   3. No localhost:4010, abra o console e execute:
 *      document.cookie = 'cw_d_session_info=VALOR_COPIADO; path=/'
 *   4. Recarregue a página
 */
import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const PRODUCTION_URL = process.env.PRODUCTION_URL;

if (!PRODUCTION_URL) {
  throw new Error(
    '\n\nERRO: Defina a variável PRODUCTION_URL antes de rodar.\n' +
      'Exemplo: PRODUCTION_URL=https://atendimento.amelingerie.com node ./node_modules/vite/bin/vite.js --config vite.localdev.config.mts\n'
  );
}

const wsTarget = PRODUCTION_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

// Extensões de assets que nunca devem ser interceptadas
const ASSET_EXTENSIONS =
  /\.(js|ts|jsx|tsx|vue|css|scss|sass|less|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)(\?.*)?$/;

// Prefixos do Vite que nunca devem ser interceptados
const VITE_PREFIXES = ['/@', '/__vite', '/node_modules', '/app/javascript'];

function isViteAsset(url: string): boolean {
  if (ASSET_EXTENSIONS.test(url)) return true;
  for (const prefix of VITE_PREFIXES) {
    if (url.startsWith(prefix)) return true;
  }
  return false;
}

function isApiRoute(url: string): boolean {
  return (
    url.startsWith('/api/') ||
    url.startsWith('/auth/') ||
    url.startsWith('/rails/') ||
    url.startsWith('/cable')
  );
}

/**
 * Plugin que serve o shell HTML da SPA para todas as rotas de navegação,
 * buscando window.chatwootConfig da produção uma única vez na inicialização.
 */
function chatwootLocalDevPlugin(productionUrl: string): Plugin {
  let cachedHtml: string | null = null;

  async function buildShellHtml(): Promise<string> {
    console.log(`[localdev] Buscando config de ${productionUrl}/app/login ...`);
    try {
      const res = await fetch(`${productionUrl}/app/login`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

      const html = await res.text();
      const configMatch = html.match(/<script>\s*window\.chatwootConfig[\s\S]*?<\/script>/);
      const analyticsMatch = html.match(/<script>\s*window\.analyticsConfig[\s\S]*?<\/script>/);

      const configScript = configMatch?.[0] ?? '<script>window.chatwootConfig = {};</script>';
      const analyticsScript = analyticsMatch?.[0] ?? '';

      console.log('[localdev] Config obtida com sucesso.');

      return `<!DOCTYPE html>
<html>
  <head>
    <title>Chatwoot · Local Dev → ${productionUrl}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=0"/>
    ${configScript}
    ${analyticsScript}
    <script>
      window.errorLoggingConfig = '';
      window.browserConfig = { browser_name: 'Chrome' };
    </script>
  </head>
  <body class="text-slate-600">
    <div id="app"></div>
    <script type="module" src="/app/javascript/entrypoints/dashboard.js"></script>
  </body>
</html>`;
    } catch (err) {
      console.error(`[localdev] Falha ao buscar config: ${err}`);
      return `<!DOCTYPE html>
<html><body>
  <pre style="color:red">Erro ao conectar em ${productionUrl}: ${err}</pre>
  <p>Verifique se PRODUCTION_URL está correto e a rede está acessível.</p>
</body></html>`;
    }
  }

  return {
    name: 'chatwoot-localdev',
    configureServer(server) {
      // Busca o HTML shell ao iniciar o servidor
      buildShellHtml().then(html => {
        cachedHtml = html;
      });

      // Middleware SPA: serve o mesmo HTML para todas as rotas de navegação
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';

        // Deixa assets e rotas de API passarem normalmente
        if (isViteAsset(url) || isApiRoute(url)) return next();

        // Para todo o resto (rotas da SPA), serve o shell HTML
        if (!cachedHtml) {
          cachedHtml = await buildShellHtml();
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        res.end(cachedHtml);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => ['ninja-keys'].includes(tag),
        },
      },
    }),
    chatwootLocalDevPlugin(PRODUCTION_URL),
  ],

  server: {
    port: 4010,
    proxy: {
      '/api': {
        target: PRODUCTION_URL,
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: PRODUCTION_URL,
        changeOrigin: true,
        secure: false,
      },
      '/rails': {
        target: PRODUCTION_URL,
        changeOrigin: true,
        secure: false,
      },
      '/cable': {
        target: wsTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },

  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      components: path.resolve('./app/javascript/dashboard/components'),
      next: path.resolve('./app/javascript/dashboard/components-next'),
      v3: path.resolve('./app/javascript/v3'),
      dashboard: path.resolve('./app/javascript/dashboard'),
      helpers: path.resolve('./app/javascript/shared/helpers'),
      shared: path.resolve('./app/javascript/shared'),
      survey: path.resolve('./app/javascript/survey'),
      widget: path.resolve('./app/javascript/widget'),
      assets: path.resolve('./app/javascript/dashboard/assets'),
    },
  },
});
