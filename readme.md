# Deletar mensagens em massa no Discord

> :warning: **Qualquer ferramenta para deletar mensagens, incluindo esta, pode resultar no encerramento de sua conta** (veja [self-bots](https://support.discordapp.com/hc/en-us/articles/115002192352-Automated-user-accounts-self-bots-)).
> Discord parece ter começado recentemente a encerrar contas usando autobots. Use por sua conta e risco.

**Inicialmente os arquivos da pasta help estão em inglês, estou trabalhando em uma documentação bilíngue**

1. Instale uma **extensão no navegador** para gerenciar **scripts de usuário** (pule se você já tiver um):
    
    - Chrome: [Violentmonkey](https://chrome.google.com/webstore/detail/violent-monkey/jinjaccalgkegednnccohejagnlnfdag) or [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)     
    - Firefox: [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/), [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/), or [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/)  
    - Microsoft Edge: [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) or [Violentmonkey](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenkkddmbclomhiblgggliao)  
    - Opera: [Tampermonkey](https://addons.opera.com/extensions/details/tampermonkey-beta/) or [Violentmonkey](https://addons.opera.com/extensions/details/violent-monkey/)  

2. Instalar Script **<a href="https://openuserjs.org/scripts/herrmannjob/Deletar_mensagens_em_massa_no_Discord" target="_blank">Via OpenUserJS</a> ou <a href="https://greasyfork.org/pt-BR/scripts/430971-deletar-mensagens-em-massa-no-discord" target="_blank">Via GreasyFork</a>**

3. Abra o <a href="https://discord.com/channels/@me" target="_blank">Discord</a> em seu __navegador__ (não no aplicativo ou software) e vá para o Canal/Conversa que deseja deletar.

4. Clique no *Ícone da lixeira* o qual foi adicionado ao *canto superior direito*

5. CLique nos botões azuis próximos aos campos **Autenticação**, **Usuário** e **Canal**.  
   *(Opcional: pegando [authToken](./help/authToken.md), [authorId](./help/authorId.md), [channelId](./help/channelId.md) e [messageId](./help/messageId.md)  manualmente)*

6. Clique em **COMEÇAR**.

Eu fiz essa ferramenta em português para ajudar ❤️ , seria maravilhoso se tu clicasse no [⭐️ Botão Estrela](https://github.com/herrmannjob/deletarMensagensDiscord) at the top! 
   
Caso precise de ajuda ou queira relatar uma falha [abra uma falha aqui](https://github.com/herrmannjob/deletarMensagensDiscord/issues)

> Ficarei extremamente agradecido caso tu queira [me pagar um café](https://www.buymeacoffee.com/souherrmann).

----

#### Funcionalidades

- Script rápido, possui autoajuste de como sua internet e o discord funcionam/permitem!
- Interface visual acessível e de fácil instrução
- Guiado e respeitando a API do Discord
- Auto detecta [authToken](./help/authToken.md), [authorId](./help/authorId.md), [channelId](./help/channelId.md)
- Capaz de deletar um [alcance específico de mensagens](./help/messageId.md)
- Capaz de deletar somente [links ou arquivos](./help/filters.md)
- Oculta informações privadas no método de Screenshots
- Detecta e pula mensagens do Sistema, como "Você iniciou uma chamada"
- Capacidade de utilização do computador e do Discord enquanto está em execução
- Comece/pare sempre que quiser
- Funciona com milhares de mensagens

----
# NÃO COMPARTILHE SEU `TOKEN`!

Compartilhar seu token de autenticação dá acesso total à sua conta! [Existem bots coletando credenciais em toda a Internet](https://github.com/rndinfosecguy/Scavenger).
Se você posta-lo por acidente, saia da sua conta do discord no exato **navegador** onde você o pegou, imediatamente.
Alterar sua senha fará com que você saia de sua conta em todos os dispositivos conectados. Aconselho você habilitar a famosa [2FA](https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Two-Factor-Authentication) "autenticação de 2 etapas", para uma maior segurança.
