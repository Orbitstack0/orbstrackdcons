<#
.SYNOPSIS
    Script de build e preparação para publicação da Decolar Consórcios 1.0 no GitHub Pages.
.DESCRIPTION
    1. Valida a presença de todos os arquivos obrigatórios.
    2. Gera a pasta de publicação (dist/) com estrutura de diretórios para URLs limpas (rota/index.html).
    3. Exclui arquivos privados, segredos, scripts SQL, backups, temporários e configs de outros hosts.
    4. Gera .nojekyll e CNAME para o domínio personalizado no GitHub Pages.
    5. Converte links internos para as rotas com barra final (/rota/) do GitHub Pages.
    6. Converte caminhos de assets (CSS, JS, imagens, favicons) para raiz (/css/..., /js/..., /assets/...).
    7. Insere metadados canônicos oficiais compatíveis com o GitHub Pages.
    8. Garante codificação UTF-8 sem BOM em todos os arquivos gerados.
#>

[CmdletBinding()]
param(
    [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DECOLAR CONSÓRCIOS — BUILD PARA GITHUB PAGES (1.0)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$sourceRoot = $PSScriptRoot
if (-not $sourceRoot) { $sourceRoot = Get-Location }
$targetRoot = Join-Path $sourceRoot $OutputDir

Write-Host "Origem:  $sourceRoot"
Write-Host "Destino: $targetRoot`n"

# 1. Validação de arquivos obrigatórios na origem
Write-Host "[1/7] Validando integridade dos arquivos obrigatórios..." -ForegroundColor Yellow

$requiredFiles = @(
    "index.html",
    "como-funciona.html",
    "nossa-historia.html",
    "contato.html",
    "consorcio-imoveis.html",
    "consorcio-veiculos.html",
    "consorcio-pesados.html",
    "seja-um-representante.html",
    "blog.html",
    "artigo.html",
    "contribua-com-o-blog.html",
    "simulacao.html",
    "politica-de-privacidade.html",
    "termos-de-uso.html",
    "politica-de-cookies.html",
    "manutencao.html",
    "sitemap.xml",
    "robots.txt",
    "css/styles.css",
    "js/script.js"
)

foreach ($req in $requiredFiles) {
    $fullPath = Join-Path $sourceRoot $req
    if (-not (Test-Path $fullPath)) {
        throw "ERRO CRÍTICO DE BUILD: Arquivo obrigatório ausente: $req"
    }
}
Write-Host "   -> Todos os $($requiredFiles.Count) arquivos obrigatórios validados com sucesso." -ForegroundColor Green

# 2. Limpar / criar diretório de saída
if (Test-Path $targetRoot) {
    Write-Host "[2/7] Limpando pasta de saída existente..." -ForegroundColor Yellow
    Remove-Item $targetRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
Write-Host "[2/7] Diretório '$OutputDir' preparado com sucesso." -ForegroundColor Green

# 3. Padrões de exclusão de segurança (não devem ir para o GitHub Pages)
$excludedDirNames = @(
    ".git",
    ".gemini",
    ".vscode",
    ".claude",
    ".github",
    "scratch",
    "scratch_downloads",
    "audit",
    "cf_screenshots",
    "_hero_backup",
    "backup_pre_correcao",
    "backup_pre_correcao_urls"
)

$excludedFilePatterns = @(
    '^\..*ignore$',
    '\.sql$',
    '^\.env',
    '\.bak$',
    '\.old$',
    '\.tmp$',
    '\.log$',
    '\.ps1$',
    '^broken_.*\.html$',
    '^measure_.*\.html$',
    '^res_.*\.html$',
    '^check_.*\.html$',
    '^deploy-exclusions\.txt$',
    '^\.htaccess$',
    '^vercel\.json$',
    '^_redirects$'
)

function ShouldExcludeFile($relativePath) {
    $fileName = Split-Path $relativePath -Leaf
    foreach ($pattern in $excludedFilePatterns) {
        if ($fileName -match $pattern) {
            return $true
        }
    }
    return $false
}

# 4. Copiar diretórios de assets, CSS, JS e painel administrativo
Write-Host "[3/7] Copiando diretórios de assets, estilos, scripts e admin..." -ForegroundColor Yellow

$dirsToCopy = @("assets", "css", "js", "admin")
foreach ($dir in $dirsToCopy) {
    $srcDir = Join-Path $sourceRoot $dir
    if (Test-Path $srcDir) {
        $destDir = Join-Path $targetRoot $dir
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null

        Get-ChildItem -Path $srcDir -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($srcDir.Length).TrimStart('\', '/')
            $destPath = Join-Path $destDir $rel

            if ($_.PSIsContainer) {
                if ($excludedDirNames -contains $_.Name) {
                    return
                }
                if (-not (Test-Path $destPath)) {
                    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
                }
            } else {
                if (-not (ShouldExcludeFile $rel)) {
                    $parent = Split-Path $destPath -Parent
                    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                    Copy-Item $_.FullName -Destination $destPath -Force
                }
            }
        }
        Write-Host "   -> Pasta '$dir' copiada e filtrada."
    }
}

# 5. Copiar arquivos raiz estáticos essenciais (robots, sitemap, favicon)
Write-Host "[4/7] Configurando arquivos de metadados e GitHub Pages..." -ForegroundColor Yellow

$rootAssets = @("favicon.ico", "robots.txt", "sitemap.xml")
foreach ($ra in $rootAssets) {
    $srcFile = Join-Path $sourceRoot $ra
    if (Test-Path $srcFile) {
        Copy-Item $srcFile -Destination (Join-Path $targetRoot $ra) -Force
        Write-Host "   -> $ra copiado."
    }
}

# Criação dos arquivos específicos do GitHub Pages:
# .nojekyll (impede o processador Jekyll de ignorar pastas ou alterar arquivos)
New-Item -ItemType File -Path (Join-Path $targetRoot ".nojekyll") -Force | Out-Null
Write-Host "   -> .nojekyll criado com sucesso." -ForegroundColor Green

# CNAME (domínio personalizado oficial configurado no Registro.br)
$cnameContent = "decolarconsorcios.com.br"
[System.IO.File]::WriteAllText((Join-Path $targetRoot "CNAME"), $cnameContent, [System.Text.Encoding]::ASCII)
Write-Host "   -> CNAME configurado para '$cnameContent'." -ForegroundColor Green

# 6. Estruturação em diretórios (rotas) e conversão de links e assets
Write-Host "[5/7] Gerando diretórios de rotas e convertendo links/assets..." -ForegroundColor Yellow

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# Mapa de transformação de links de páginas para rotas de diretório com barra final
$linkMap = [ordered]@{
    'href="como-funciona.html"'            = 'href="/como-funciona/"'
    'href="nossa-historia.html"'           = 'href="/nossa-historia/"'
    'href="contato.html"'                  = 'href="/contato/"'
    'href="consorcio-imoveis.html"'        = 'href="/consorcio-imoveis/"'
    'href="consorcio-veiculos.html"'       = 'href="/consorcio-veiculos/"'
    'href="consorcio-pesados.html"'        = 'href="/consorcio-pesados/"'
    'href="seja-um-representante.html"'    = 'href="/seja-um-representante/"'
    'href="blog.html"'                     = 'href="/blog/"'
    'href="artigo.html"'                   = 'href="/artigo/"'
    'href="contribua-com-o-blog.html"'     = 'href="/contribua-com-o-blog/"'
    'href="simulacao.html"'                = 'href="/simulacao/"'
    'href="simulacao.html?'                = 'href="/simulacao/?'
    'href="politica-de-privacidade.html"'  = 'href="/politica-de-privacidade/"'
    'href="termos-de-uso.html"'            = 'href="/termos-de-uso/"'
    'href="politica-de-cookies.html"'      = 'href="/politica-de-cookies/"'
    'href="manutencao.html"'               = 'href="/manutencao/"'
    'href="index.html#inicio"'             = 'href="/#inicio"'
    'href="index.html#consorcios"'         = 'href="/#consorcios"'
    'href="index.html#como-funciona"'      = 'href="/#como-funciona"'
    'href="index.html#depoimentos"'        = 'href="/#depoimentos"'
    'href="index.html#perguntas"'          = 'href="/#perguntas"'
    'href="index.html"'                    = 'href="/"'
}

# Mapa de conversão de caminhos de assets para raiz absoluta (funciona em qualquer subpasta no GitHub Pages)
$assetMap = [ordered]@{
    'href="css/'                           = 'href="/css/'
    'href="assets/'                        = 'href="/assets/'
    'href="favicon.ico"'                   = 'href="/favicon.ico"'
    'src="js/'                             = 'src="/js/'
    'src="assets/'                         = 'src="/assets/'
    'url(''assets/'                        = 'url(''/assets/'
    'url("assets/'                         = 'url("/assets/'
    'url(\''assets/'                       = 'url(\''/assets/'
}

function ProcessHtmlContent($rawContent, $isHome = $false, $route = "") {
    $content = $rawContent

    # 1. Converter links de navegação para as rotas com barra final
    foreach ($entry in $linkMap.GetEnumerator()) {
        $content = $content.Replace($entry.Key, $entry.Value)
    }

    # Ajuste fino para a Home: âncoras locais continuam simples (#inicio, #consorcios, etc.)
    if ($isHome) {
        $content = $content.Replace('href="/#inicio"', 'href="#inicio"')
        $content = $content.Replace('href="/#consorcios"', 'href="#consorcios"')
        $content = $content.Replace('href="/#como-funciona"', 'href="#como-funciona"')
        $content = $content.Replace('href="/#depoimentos"', 'href="#depoimentos"')
        $content = $content.Replace('href="/#perguntas"', 'href="#perguntas"')
    }

    # 2. Converter referências a assets para caminho absoluto
    foreach ($entry in $assetMap.GetEnumerator()) {
        $content = $content.Replace($entry.Key, $entry.Value)
    }

    # 3. Canonical para subpáginas caso não possua
    if (-not $isHome -and $route -and ($content -notmatch '<link rel="canonical"')) {
        $canonTag = "  <link rel=""canonical"" href=""https://decolarconsorcios.com.br/$route/"">"
        if ($content -match '(?i)(<meta\s+name=["'']description["''][^>]*>)') {
            $content = $content -replace '(?i)(<meta\s+name=["'']description["''][^>]*>)', "`$1`n$canonTag"
        } elseif ($content -match '(?i)(</title>)') {
            $content = $content -replace '(?i)(</title>)', "`$1`n$canonTag"
        }
    }

    return $content
}

# A. Processar Home: dist/index.html
$homeSrc = Join-Path $sourceRoot "index.html"
$homeRaw = [System.IO.File]::ReadAllText($homeSrc, [System.Text.Encoding]::UTF8)
$homeProcessed = ProcessHtmlContent $homeRaw -isHome $true
[System.IO.File]::WriteAllText((Join-Path $targetRoot "index.html"), $homeProcessed, $utf8NoBom)
Write-Host "   -> dist/index.html gerado (Home)."

# B. Processar subpáginas públicas: cada uma vira dist/<rota>/index.html
$subpagesConfig = @(
    @{ File = "como-funciona.html";          Route = "como-funciona" },
    @{ File = "nossa-historia.html";         Route = "nossa-historia" },
    @{ File = "contato.html";                Route = "contato" },
    @{ File = "consorcio-imoveis.html";      Route = "consorcio-imoveis" },
    @{ File = "consorcio-veiculos.html";     Route = "consorcio-veiculos" },
    @{ File = "consorcio-pesados.html";      Route = "consorcio-pesados" },
    @{ File = "seja-um-representante.html";  Route = "seja-um-representante" },
    @{ File = "blog.html";                   Route = "blog" },
    @{ File = "artigo.html";                 Route = "artigo" },
    @{ File = "contribua-com-o-blog.html";   Route = "contribua-com-o-blog" },
    @{ File = "simulacao.html";              Route = "simulacao" },
    @{ File = "politica-de-privacidade.html"; Route = "politica-de-privacidade" },
    @{ File = "termos-de-uso.html";          Route = "termos-de-uso" },
    @{ File = "politica-de-cookies.html";    Route = "politica-de-cookies" },
    @{ File = "manutencao.html";             Route = "manutencao" }
)

$subpageCount = 0
foreach ($sp in $subpagesConfig) {
    $srcPath = Join-Path $sourceRoot $sp.File
    $routeDir = Join-Path $targetRoot $sp.Route
    New-Item -ItemType Directory -Path $routeDir -Force | Out-Null

    $raw = [System.IO.File]::ReadAllText($srcPath, [System.Text.Encoding]::UTF8)
    $processed = ProcessHtmlContent $raw -isHome $false -route $sp.Route
    
    $destPath = Join-Path $routeDir "index.html"
    [System.IO.File]::WriteAllText($destPath, $processed, $utf8NoBom)
    $subpageCount++
    Write-Host "   -> dist/$($sp.Route)/index.html gerado."
}

# 7. Rotas limpas para o painel administrativo (dist/admin/<rota>/index.html),
#    ADICIONADAS ao lado dos arquivos .html originais já copiados no passo
#    anterior (cópia verbatim da pasta admin/) — nenhum arquivo .html antigo
#    é removido ou sobrescrito (exceto admin/index.html, cuja rota limpa é a
#    própria "/admin/"), então endereços antigos como /admin/login.html
#    continuam respondendo normalmente, sem precisar de redirect 301.
Write-Host "[6/7] Gerando rotas limpas do painel administrativo..." -ForegroundColor Yellow

# Mapa de navegação entre páginas do admin (links <a href="x.html"> internos)
$adminLinkMap = [ordered]@{
    'href="index.html"'                = 'href="/admin/"'
    'href="login.html"'                = 'href="/admin/login/"'
    'href="redefinir-senha.html"'      = 'href="/admin/redefinir-senha/"'
    'href="selecionar-perfil.html"'    = 'href="/admin/selecionar-perfil/"'
    'href="artigos.html"'              = 'href="/admin/artigos/"'
    'href="artigo-editor.html"'        = 'href="/admin/artigo-editor/"'
    'href="artigo-detalhes.html"'      = 'href="/admin/artigo-detalhes/"'
    'href="chat.html"'                 = 'href="/admin/chat/"'
    'href="crm.html"'                  = 'href="/admin/crm/"'
    'href="crm-agenda.html"'           = 'href="/admin/crm-agenda/"'
    'href="crm-clientes.html"'         = 'href="/admin/crm-clientes/"'
    'href="crm-oportunidades.html"'    = 'href="/admin/crm-oportunidades/"'
    'href="crm-relatorios.html"'       = 'href="/admin/crm-relatorios/"'
    'href="crm-tv.html"'               = 'href="/admin/crm-tv/"'
}

# Mapa de recursos compartilhados com a raiz do site e com a própria pasta
# admin/ — precisa virar caminho absoluto porque as novas rotas em
# diretório (/admin/<rota>/index.html) ficam um nível mais profundas do
# que os arquivos .html originais (admin/<arquivo>.html).
$adminAssetMap = [ordered]@{
    'href="../favicon.ico"'  = 'href="/favicon.ico"'
    'href="../assets/'       = 'href="/assets/'
    'src="../assets/'        = 'src="/assets/'
    'href="../css/'          = 'href="/css/'
    'href="../index.html"'   = 'href="/"'
    'href="css/'             = 'href="/admin/css/'
    'src="js/'                = 'src="/admin/js/'
}

function ProcessAdminHtmlContent($rawContent) {
    $content = $rawContent
    foreach ($entry in $adminLinkMap.GetEnumerator()) {
        $content = $content.Replace($entry.Key, $entry.Value)
    }
    foreach ($entry in $adminAssetMap.GetEnumerator()) {
        $content = $content.Replace($entry.Key, $entry.Value)
    }
    return $content
}

$adminRoutesConfig = @(
    @{ File = "artigos.html";             Route = "artigos" },
    @{ File = "artigo-editor.html";       Route = "artigo-editor" },
    @{ File = "artigo-detalhes.html";     Route = "artigo-detalhes" },
    @{ File = "chat.html";                Route = "chat" },
    @{ File = "crm.html";                 Route = "crm" },
    @{ File = "crm-agenda.html";          Route = "crm-agenda" },
    @{ File = "crm-clientes.html";        Route = "crm-clientes" },
    @{ File = "crm-oportunidades.html";   Route = "crm-oportunidades" },
    @{ File = "crm-relatorios.html";      Route = "crm-relatorios" },
    @{ File = "crm-tv.html";              Route = "crm-tv" },
    @{ File = "login.html";               Route = "login" },
    @{ File = "redefinir-senha.html";     Route = "redefinir-senha" },
    @{ File = "selecionar-perfil.html";   Route = "selecionar-perfil" }
)

$adminSourceDir = Join-Path $sourceRoot "admin"
$adminDistDir = Join-Path $targetRoot "admin"

$adminRouteCount = 0
foreach ($ar in $adminRoutesConfig) {
    $srcPath = Join-Path $adminSourceDir $ar.File
    if (-not (Test-Path $srcPath)) { continue }

    $routeDir = Join-Path $adminDistDir $ar.Route
    New-Item -ItemType Directory -Path $routeDir -Force | Out-Null

    $raw = [System.IO.File]::ReadAllText($srcPath, [System.Text.Encoding]::UTF8)
    $processed = ProcessAdminHtmlContent $raw
    [System.IO.File]::WriteAllText((Join-Path $routeDir "index.html"), $processed, $utf8NoBom)
    $adminRouteCount++
}

# admin/index.html é o único caso em que a rota limpa ("/admin/") coincide
# com o próprio local do arquivo — por isso ele é reprocessado e
# SOBRESCRITO em dist/admin/index.html (ao contrário dos demais, que são
# adicionados em subpastas novas, sem tocar no .html original).
$adminIndexSrc = Join-Path $adminSourceDir "index.html"
if (Test-Path $adminIndexSrc) {
    $adminIndexRaw = [System.IO.File]::ReadAllText($adminIndexSrc, [System.Text.Encoding]::UTF8)
    $adminIndexProcessed = ProcessAdminHtmlContent $adminIndexRaw
    [System.IO.File]::WriteAllText((Join-Path $adminDistDir "index.html"), $adminIndexProcessed, $utf8NoBom)
    $adminRouteCount++
}

Write-Host "   -> $adminRouteCount rotas limpas do admin geradas em dist/admin/<rota>/, preservando os .html originais." -ForegroundColor Green

# 8. Auditoria de segurança e validação final do pacote gerado
Write-Host "[7/7] Auditando segurança e integridade do pacote gerado..." -ForegroundColor Yellow

$sensitiveFilesFound = Get-ChildItem -Path $targetRoot -Recurse -File | Where-Object {
    $_.Name -match '\.(sql|env|bak|tmp|log)$|^broken_|^measure_|^res_|^check_'
}

if ($sensitiveFilesFound.Count -gt 0) {
    Write-Host "❌ ALERTA DE SEGURANÇA: Arquivos sensíveis encontrados no pacote!" -ForegroundColor Red
    $sensitiveFilesFound | ForEach-Object { Write-Host "   ! $($_.FullName)" -ForegroundColor Red }
    throw "Build interrompido por falha de segurança."
} else {
    Write-Host "   -> Nenhum arquivo sensível ou temporário no pacote (100% limpo)." -ForegroundColor Green
}

# Validação da presença dos arquivos essenciais de deploy
$essentialDeployFiles = @(".nojekyll", "CNAME", "sitemap.xml", "robots.txt", "index.html")
foreach ($f in $essentialDeployFiles) {
    if (-not (Test-Path (Join-Path $targetRoot $f))) {
        throw "ERRO CRÍTICO: Arquivo essencial de deploy ausente: $f"
    }
}
Write-Host "   -> Arquivos de deploy do GitHub Pages (.nojekyll, CNAME, sitemap, robots) verificados." -ForegroundColor Green

$sw.Stop()
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  BUILD CONCLUÍDO COM SUCESSO! ($($sw.ElapsedMilliseconds) ms)        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Pasta de produção: $targetRoot"
Write-Host "Rotas estruturadas em diretórios (/rota/index.html): $($subpageCount + 1)"
Write-Host "Domínio configurado no CNAME: $cnameContent"
Write-Host "Pronto para deploy automático via GitHub Actions ou branch de publicação."
