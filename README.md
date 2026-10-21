# Gestão Oliveira

Sistema desktop de vendas, estoque e controle de caixa, desenvolvido com Electron, React, TypeScript e Vite.

Este guia foi escrito para Windows 10/11 e usa **PowerShell** nos comandos.

## Instalar no computador da loja (modo recomendado)

O computador da loja **não precisa ter Git, Node.js ou pnpm** se você receber o instalador já compilado de outro computador.

1. No computador de desenvolvimento, siga a seção **Preparar e gerar o instalador** abaixo.
2. Depois da compilação, abra a pasta do projeto e entre em `release\0.0.0\`.
3. Copie o arquivo de instalação `.exe` para um pendrive ou disponibilize-o por um meio confiável.
4. No computador da loja, abra o arquivo `.exe` e siga as telas do instalador.
5. Ao terminar, abra o Gestão Oliveira pelo atalho criado pelo instalador.

> O instalador ainda não é publicado automaticamente como um download na página do GitHub. Por enquanto, é necessário gerar o arquivo no computador de desenvolvimento e copiá-lo para o computador da loja.

## Preparar e gerar o instalador (PowerShell)

Faça estes passos em um computador Windows com acesso à internet.

### 1. Instalar os pré-requisitos

Instale:

- **Git para Windows:** https://git-scm.com/download/win
- **Node.js LTS:** https://nodejs.org/

Depois da instalação, feche e abra novamente o PowerShell. Confira:

```powershell
git --version
node --version
npm --version
```

### 2. Instalar o pnpm

No PowerShell, execute:

```powershell
npm install --global pnpm
```

Confira a instalação:

```powershell
pnpm --version
```

### 3. Baixar o projeto do GitHub

Execute os comandos um por vez:

```powershell
Set-Location "$HOME\Documents"
git clone https://github.com/yagodiax/gestao-oliveira.git
Set-Location ".\gestao-oliveira"
```

Se a pasta `gestao-oliveira` já existir, entre nela em vez de executar novamente o `git clone`:

```powershell
Set-Location "$HOME\Documents\gestao-oliveira"
git pull origin main
```

### 4. Instalar as dependências do projeto

Dentro da pasta do projeto:

```powershell
pnpm install
```

Aguarde o comando terminar sem erros.

### 5. Gerar o instalador do Windows

Execute:

```powershell
pnpm build
```

Esse comando verifica e compila o projeto e tenta gerar o instalador do aplicativo. Se terminar com sucesso, procure o instalador dentro da pasta:

```powershell
Get-ChildItem ".\release" -Recurse -Filter "*Setup.exe"
```

O caminho exato e o nome do arquivo dependem das configurações atuais de empacotamento. Copie o `.exe` encontrado para um pendrive e execute-o no computador da loja.

## Abrir o projeto para desenvolvimento

Se quiser executar o aplicativo em modo de desenvolvimento, entre na pasta do projeto e rode:

```powershell
pnpm dev
```

Para verificar os problemas de lint:

```powershell
pnpm lint
```

## Atualizar o projeto

No computador que contém o código-fonte, abra o PowerShell na pasta do projeto e execute:

```powershell
git pull origin main
pnpm install
pnpm build
```

Se você usa o aplicativo instalado na loja, gerar uma nova versão do código **não atualiza automaticamente** o aplicativo já instalado. É necessário gerar um novo instalador e instalá-lo no computador da loja.

## Solução de problemas

- **'git' não é reconhecido:** instale o Git para Windows e abra um novo PowerShell.
- **'node' ou 'npm' não é reconhecido:** instale o Node.js LTS e abra um novo PowerShell.
- **'pnpm' não é reconhecido:** execute `npm install --global pnpm` e abra um novo PowerShell.
- **A compilação falhou:** leia a primeira mensagem de erro no PowerShell; não copie o instalador se `pnpm build` não terminar com sucesso.
- **Não encontrou o instalador:** confirme se `pnpm build` terminou sem erros e procure arquivos `*Setup.exe` dentro de `release`.

## Tecnologias

- Electron
- React
- TypeScript
- Vite
- pnpm
