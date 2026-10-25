# DJ Studio PRO — Node.js

Projeto desktop para Windows em Electron. A aba **Arquivos e Biblioteca** inclui o painel **Playlist Analyzer**, integrado à mesma biblioteca e às playlists do DJ Studio PRO. O Melody Studio acompanha o tema e as cores selecionados nas configurações do DJ Studio PRO.

## Playlist Analyzer

Abra o painel expansível no topo da biblioteca e escolha **Analisar faixas sem análise**. O BPM e a tonalidade estimada são gravados na faixa da biblioteca, junto com o código Camelot e a energia usados pelo Analyzer. As sugestões comparam a música de referência com faixas compatíveis em tom e BPM. **Próxima** coloca uma sugestão depois da referência na playlist selecionada.

Importação, criação, exclusão e exportação de playlists continuam usando os controles nativos da biblioteca; o Analyzer não repete esses botões. O separador horizontal ajusta o espaço entre o painel e a lista de músicas, e o divisor interno ajusta a largura entre análise da playlist e sugestões.

A análise de áudio é feita localmente no aplicativo. As listas e a biblioteca permanecem compartilhadas com o DJ Studio PRO. A aba Próxima oferece apenas as faixas analisadas compatíveis nas sugestões e mostra uma faixa deslizante com duração, playlist, contagem regressiva, tom, BPM e recomendações de transição do Auto Mix e do Remix Inteligente.

## Atualizações automáticas

O app instalado verifica atualizações ao iniciar e a cada seis horas. Quando encontra uma versão nova, mostra um aviso com as opções **Instalar agora**, **Instalar ao fechar o app** e **Lembrar mais tarde**. O download é feito em segundo plano; se o usuário fechar o app durante um download marcado para instalação, o DJ Studio PRO termina o download e instala a atualização ao fechar.

As versões são publicadas como Releases no repositório público [ernestogodoi4-ship-it/Dj_Studio_Pro](https://github.com/ernestogodoi4-ship-it/Dj_Studio_Pro). Para lançar uma versão, atualize a versão em `package.json` e `package-lock.json` (por exemplo, `npm version 2.4.2 --no-git-tag-version`) e envie o commit ao branch `main` com a mensagem começando por `Release `. O workflow `.github/workflows/release-windows.yml` compila o instalador NSIS x64 e publica o instalador e o manifesto de atualização na Release. Ele também pode ser iniciado manualmente em GitHub Actions. O GitHub Actions usa o `GITHUB_TOKEN` automático do workflow; não é necessário colocar token no aplicativo ou no código-fonte.

**Primeira instalação do atualizador:** versões anteriores a 2.4.2 não contêm o mecanismo de atualização. Portanto, quem já tem uma versão antiga instalada precisa instalar manualmente o instalador 2.4.2 uma vez. Depois dessa instalação, as próximas versões chegam pelo aviso automático.

O instalador NSIS gerado não é assinado com certificado Authenticode neste projeto. A configuração do atualizador aceita esses instaladores sem validação do certificado; os downloads continuam sendo conferidos pelo manifesto e pelo SHA-512 do electron-builder. Uma assinatura digital de publicação pode ser adicionada futuramente para validar também o editor do instalador no Windows.

## Como gerar o instalador EXE

1. Instale o Node.js LTS pelo site oficial: https://nodejs.org/.
2. Extraia o ZIP para uma pasta do Windows.
3. Execute `GERAR_INSTALADOR.bat` com dois cliques.
4. Aguarde o download das dependências e a compilação.
5. O instalador será criado na pasta `dist`.

A compilação precisa de conexão com a internet para baixar Electron, electron-builder e as ferramentas de empacotamento. O projeto gera um instalador NSIS x64 para o usuário atual, com seleção da pasta, atalhos e desinstalador. O ZIP contém o projeto preparado para compilar; não inclui um instalador EXE pré-compilado.

## Executar em modo de desenvolvimento

Execute `ABRIR_EM_MODO_DESENVOLVIMENTO.bat`. Na primeira execução, o script instala as dependências e inicia o aplicativo. Também é possível abrir um terminal nessa pasta e executar `npm install` seguido de `npm start`.

O verificador automático é ativado apenas no aplicativo empacotado. A execução em modo de desenvolvimento não consulta Releases nem exibe o diálogo de atualizações.

## Temas e reações visuais

O seletor de aparência inclui paletas para DJ Studio PRO, SUNANDO, Mixora e WaveSynk, além de referências cromáticas do YouTube, Spotify e Suno. Há skins inspiradas em hardware Pioneer DJ (NXS/Opus), Neon Club e dois acabamentos Vintage Vinyl (nogueira e marfim). O tema e a reação de cor escolhidos também são sincronizados com o Melody Studio embutido.

Os modos reativos incluem batida, espectro, subgrave, graves, médios/voz, agudos, fogo, gelo, aurora, ciclo RGB e alternância RGB por batida. A análise usa bandas de frequência dedicadas; o brilho pode ser reduzido nas configurações.

SUNANDO, Mixora e WaveSynk são aplicativos externos iniciados pelo launcher. Este pacote não contém o código-fonte nem altera a aparência interna desses executáveis; as paletas com esses nomes aplicam-se ao DJ Studio PRO e ao Melody Studio integrado.

## Novidades desta revisão

- Checagem de atualizações no início do aplicativo empacotado e em intervalo periódico.
- Aviso nativo com escolha de instalar agora, ao fechar o aplicativo ou mais tarde.
- Publicação de versões Windows por GitHub Actions e GitHub Releases.
- O botão **Próxima** pode iniciar o Auto Mix a partir da faixa que já está tocando e transicionar para a sugestão escolhida, preservando a posição atual.
- O Melody Studio tem uma **Fila de preparação** persistente: adicione sugestões, reordene ou remova faixas; o Auto Mix prioriza a fila.
- Faixas geradas no Melody Studio chegam à biblioteca de DJ com BPM, tom, Camelot e estilo do projeto, além de identificação visual de origem.
- A gravação mostra pico e RMS em dBFS e destaca clipping.
- Ajuste manual da grade, playlists reordenáveis, sugestões por compatibilidade/energia, limiter e capítulos de gravação já faziam parte do projeto.

A separação de stems em tempo real não foi ativada: o projeto não inclui o modelo de separação nem um runtime local compatível.

