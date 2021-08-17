// ==UserScript==
// @name          Deletar mensagens em massa no Discord
// @description   Adiciona uma interface gráfica ao discord para poder deletar suas mensagens em massa
// @namespace     https://github.com/herrmannjob/deletarMensagensDiscord
// @version       1.0
// @match         https://discord.com/*
// @downloadURL   https://raw.githubusercontent.com/herrmannjob/deletarMensagensDiscord/master/deletarMensagensDiscord.user.js
// @homepageURL   https://github.com/herrmannjob/deletarMensagensDiscord
// @supportURL    https://github.com/herrmannjob/deletarMensagensDiscord/issues
// @contributionURL https://www.buymeacoffee.com/souherrmann
// @grant         none
// @license       MIT
// ==/UserScript==

/**
 * Delete todas as mensagens em um canal do Discord ou mensagens diretas
 * @param {string} authToken Your authorization token
 * @param {string} authorId Author of the messages you want to delete
 * @param {string} guildId Server were the messages are located
 * @param {string} channelId Channel were the messages are located
 * @param {string} minId Only delete messages after this, leave blank do delete all
 * @param {string} maxId Only delete messages before this, leave blank do delete all
 * @param {string} content Filter messages that contains this text content
 * @param {boolean} hasLink Filter messages that contains link
 * @param {boolean} hasFile Filter messages that contains file
 * @param {boolean} includeNsfw Search in NSFW channels
 * @param {function(string, Array)} extLogger Function for logging
 * @param {function} stopHndl stopHndl used for stopping
 * @author SouHerrmann <https://www.github.com/herrmannjob>
 * @see https://github.com/herrmannjob/deletarMensagensDiscord
 */
async function deleteMessages(authToken, authorId, guildId, channelId, minId, maxId, content, hasLink, hasFile, includeNsfw, includePinned, searchDelay, deleteDelay, extLogger, stopHndl, onProgress) {
    const start = new Date();
    let delCount = 0;
    let failCount = 0;
    let avgPing;
    let lastPing;
    let grandTotal;
    let throttledCount = 0;
    let throttledTotalTime = 0;
    let offset = 0;
    let iterations = -1;

    const wait = async ms => new Promise(done => setTimeout(done, ms));
    const msToHMS = s => `${s / 3.6e6 | 0}h ${(s % 3.6e6) / 6e4 | 0}m ${(s % 6e4) / 1000 | 0}s`;
    const escapeHTML = html => html.replace(/[&<"']/g, m => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;', '\'': '&#039;' })[m]);
    const redact = str => `<span class="priv">${escapeHTML(str)}</span><span class="mask">REDACTED</span>`;
    const queryString = params => params.filter(p => p[1] !== undefined).map(p => p[0] + '=' + encodeURIComponent(p[1])).join('&');
    const ask = async msg => new Promise(resolve => setTimeout(() => resolve(window.confirm(msg)), 10));
    const printDelayStats = () => log.verb(`Delete delay: ${deleteDelay}ms, Search delay: ${searchDelay}ms`, `Last Ping: ${lastPing}ms, Average Ping: ${avgPing | 0}ms`);
    const toSnowflake = (date) => /:/.test(date) ? ((new Date(date).getTime() - 1420070400000) * Math.pow(2, 22)) : date;

    const log = {
        debug() { extLogger ? extLogger('debug', arguments) : console.debug.apply(console, arguments); },
        info() { extLogger ? extLogger('info', arguments) : console.info.apply(console, arguments); },
        verb() { extLogger ? extLogger('verb', arguments) : console.log.apply(console, arguments); },
        warn() { extLogger ? extLogger('warn', arguments) : console.warn.apply(console, arguments); },
        error() { extLogger ? extLogger('error', arguments) : console.error.apply(console, arguments); },
        success() { extLogger ? extLogger('success', arguments) : console.info.apply(console, arguments); },
    };

    async function recurse() {
        let API_SEARCH_URL;
        if (guildId === '@me') {
            API_SEARCH_URL = `https://discord.com/api/v6/channels/${channelId}/messages/`; // DMs
        }
        else {
            API_SEARCH_URL = `https://discord.com/api/v6/guilds/${guildId}/messages/`; // Server
        }

        const headers = {
            'Authorization': authToken
        };

        let resp;
        try {
            const s = Date.now();
            resp = await fetch(API_SEARCH_URL + 'search?' + queryString([
                ['author_id', authorId || undefined],
                ['channel_id', (guildId !== '@me' ? channelId : undefined) || undefined],
                ['min_id', minId ? toSnowflake(minId) : undefined],
                ['max_id', maxId ? toSnowflake(maxId) : undefined],
                ['sort_by', 'timestamp'],
                ['sort_order', 'desc'],
                ['offset', offset],
                ['has', hasLink ? 'link' : undefined],
                ['has', hasFile ? 'file' : undefined],
                ['content', content || undefined],
                ['include_nsfw', includeNsfw ? true : undefined],
            ]), { headers });
            lastPing = (Date.now() - s);
            avgPing = avgPing > 0 ? (avgPing * 0.9) + (lastPing * 0.1) : lastPing;
        } catch (err) {
            return log.error('Search request threw an error:', err);
        }

        // not indexed yet
        if (resp.status === 202) {
            const w = (await resp.json()).retry_after;
            throttledCount++;
            throttledTotalTime += w;
            log.warn(`Canal não indexado, aguardando ${w}ms o discord para indexa-lo...`);
            await wait(w);
            return await recurse();
        }

        if (!resp.ok) {
            // searching messages too fast
            if (resp.status === 429) {
                const w = (await resp.json()).retry_after;
                throttledCount++;
                throttledTotalTime += w;
                searchDelay += w; // increase delay
                log.warn(`Sendo o tempo limite da API de ${w}ms! Aumentando atraso na busca...`);
                printDelayStats();
                log.verb(`Tempo de recarga ${w * 2}ms antes de recomeçar...`);

                await wait(w * 2);
                return await recurse();
            } else {
                return log.error(`Erro ao buscar mensagens, API retornou o status ${resp.status}!\n`, await resp.json());
            }
        }

        const data = await resp.json();
        const total = data.total_results;
        if (!grandTotal) grandTotal = total;
        const discoveredMessages = data.messages.map(convo => convo.find(message => message.hit === true));
        const messagesToDelete = discoveredMessages.filter(msg => {
            return msg.type === 0 || msg.type === 6 || (msg.pinned && includePinned);
        });
        const skippedMessages = discoveredMessages.filter(msg => !messagesToDelete.find(m => m.id === msg.id));

        const end = () => {
            log.success(`Finalizado em ${new Date().toLocaleString()}! Tempo total: ${msToHMS(Date.now() - start.getTime())}`);
            printDelayStats();
            log.verb(`Limite de tentativas: ${throttledCount} vezes. Total de engasgadas: ${msToHMS(throttledTotalTime)}.`);
            log.debug(`${delCount} mensagens deletadas, ${failCount} falhas.\n`);
        }

        const etr = msToHMS((searchDelay * Math.round(total / 25)) + ((deleteDelay + avgPing) * total));
        log.info(`Total de mensagenss encontradas: ${data.total_results}`, `(Mensagens nesta página: ${data.messages.length}, A serem deletadas: ${messagesToDelete.length}, Sistema: ${skippedMessages.length})`, `offset: ${offset}`);
        printDelayStats();
        log.verb(`Tempo estimado restante: ${etr}`)


        if (messagesToDelete.length > 0) {

            if (++iterations < 1) {
                log.verb(`Aguardando sua confirmação...`);
                if (!await ask(`Deseja realmente deletar ~${total} mensagens?\n Tempo estimado: ${etr}\n\n---- Preview ----\n` +
                    messagesToDelete.map(m => `${m.author.username}#${m.author.discriminator}: ${m.attachments.length ? '[ATTACHMENTS]' : m.content}`).join('\n'))) {
                    return end(log.error('Cancelado por você!'));
                }
                log.verb(`OK`);
            }

            for (let i = 0; i < messagesToDelete.length; i++) {
                const message = messagesToDelete[i];
                if (stopHndl && stopHndl() === false) return end(log.error('Parado por você!'));

                log.debug(`${((delCount + 1) / grandTotal * 100).toFixed(2)}% (${delCount + 1}/${grandTotal})`,
                    `Deletando ID:${redact(message.id)} <b>${redact(message.author.username + '#' + message.author.discriminator)} <small>(${redact(new Date(message.timestamp).toLocaleString())})</small>:</b> <i>${redact(message.content).replace(/\n/g, '↵')}</i>`,
                    message.attachments.length ? redact(JSON.stringify(message.attachments)) : '');
                if (onProgress) onProgress(delCount + 1, grandTotal);

                let resp;
                try {
                    const s = Date.now();
                    const API_DELETE_URL = `https://discord.com/api/v6/channels/${message.channel_id}/messages/${message.id}`;
                    resp = await fetch(API_DELETE_URL, {
                        headers,
                        method: 'DELETE'
                    });
                    lastPing = (Date.now() - s);
                    avgPing = (avgPing * 0.9) + (lastPing * 0.1);
                    delCount++;
                } catch (err) {
                    log.error('Requisição de deletar retornou um erro:', err);
                    log.verb('Objeto relatado:', redact(JSON.stringify(message)));
                    failCount++;
                }

                if (!resp.ok) {
                    // deleting messages too fast
                    if (resp.status === 429) {
                        const w = (await resp.json()).retry_after;
                        throttledCount++;
                        throttledTotalTime += w;
                        deleteDelay = w; // increase delay
                        log.warn(`Sendo o tempo limite da API de ${w}ms! Aumentando atraso na requisição de deletar para ${deleteDelay}ms.`);
                        printDelayStats();
                        log.verb(`Tempo de recarga ${w * 2}ms antes de recomeçar...`);
                        await wait(w * 2);
                        i--; // retry
                    } else {
                        log.error(`Erro ao deletar mensagens, API respondeu com status ${resp.status}!`, await resp.json());
                        log.verb('Objeto relatado:', redact(JSON.stringify(message)));
                        failCount++;
                    }
                }

                await wait(deleteDelay);
            }

            if (skippedMessages.length > 0) {
                grandTotal -= skippedMessages.length;
                offset += skippedMessages.length;
                log.verb(`Encontrada(s) ${skippedMessages.length} mensagens do sistema! Diminuindo total em ${grandTotal} e aumentando deslocamento para ${offset}.`);
            }

            log.verb(`Procurando próxima mensagem em ${searchDelay}ms...`, (offset ? `(deslocamento: ${offset})` : ''));
            await wait(searchDelay);

            if (stopHndl && stopHndl() === false) return end(log.error('Parado por você!'));

            return await recurse();
        } else {
            if (total - offset > 0) log.warn('Finalizado porque a API retornou vazia.');
            return end();
        }
    }

    log.success(`\nComeçou em ${start.toLocaleString()}`);
    log.debug(`authorId="${redact(authorId)}" guildId="${redact(guildId)}" channelId="${redact(channelId)}" minId="${redact(minId)}" maxId="${redact(maxId)}" hasLink=${!!hasLink} hasFile=${!!hasFile}`);
    if (onProgress) onProgress(null, 1);
    return await recurse();
}

//---- User interface ----//

let popover;
let btn;
let stop;

function initUI() {

    const insertCss = (css) => {
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
        return style;
    }

    const createElm = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.removeChild(temp.firstElementChild);
    }

    insertCss(`
        #deletarMensagens-btn{position: relative; height: 24px;width: auto;-webkit-box-flex: 0;-ms-flex: 0 0 auto;flex: 0 0 auto;margin: 0 8px;cursor:pointer; color: var(--interactive-normal);}
        #deletarMensagens{position:fixed;top:100px;right:10px;bottom:10px;width:780px;z-index:99;color:var(--text-normal);background-color:var(--background-secondary);box-shadow:var(--elevation-stroke),var(--elevation-high);border-radius:4px;display:flex;flex-direction:column}
        #deletarMensagens a{color:#00b0f4}
        #deletarMensagens.redact .priv{display:none!important}
        #deletarMensagens:not(.redact) .mask{display:none!important}
        #deletarMensagens.redact [priv]{-webkit-text-security:disc!important}
        #deletarMensagens .toolbar span{margin-right:8px}
        #deletarMensagens button,#deletarMensagens .btn{color:#fff;background:#7289da;border:0;border-radius:4px;font-size:14px}
        #deletarMensagens button:disabled{display:none}
        #deletarMensagens input[type="text"],#deletarMensagens input[type="search"],#deletarMensagens input[type="password"],#deletarMensagens input[type="datetime-local"],#deletarMensagens input[type="number"]{background-color:#202225;color:#b9bbbe;border-radius:4px;border:0;padding:0 .5em;height:24px;width:144px;margin:2px}
        #deletarMensagens input#file{display:none}
        #deletarMensagens hr{border-color:rgba(255,255,255,0.1)}
        #deletarMensagens .header{padding:12px 16px;background-color:var(--background-tertiary);color:var(--text-muted)}
        #deletarMensagens .form{padding:8px;background:var(--background-secondary);box-shadow:0 1px 0 rgba(0,0,0,.2),0 1.5px 0 rgba(0,0,0,.05),0 2px 0 rgba(0,0,0,.05)}
        #deletarMensagens .logarea{overflow:auto;font-size:.75rem;font-family:Consolas,Liberation Mono,Menlo,Courier,monospace;flex-grow:1;padding:10px}
    `);

    popover = createElm(`
    <div id="deletarMensagens" style="display:none;">
        <div class="header">
            Deletar mensagens em massa do Discord
        </div>
        <div class="form">
        <div style="display:flex;flex-direction:row;justify-content: space-around;">
        <div style="display:flex;flex-direction:column;">
        <span>Autenticação
        <a href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/authToken.md" title="Help" target="_blank">?</a>
        <button id="getToken">get</button><br>
        <input type="password" id="authToken" placeholder="Auth Token" autofocus></span>
        <br>
        <span>Usuário
        <a href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/authorId.md" title="Help" target="_blank">?</a>
        <button id="getAuthor">get</button><br>
        <input id="authorId" type="text" placeholder="Author ID" priv></span>
        </div>
        <div style="display:flex;flex-direction:column;">
        <span>Canal
        <a href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/channelId.md" title="Help" target="_blank">?</a>
        <button id="getGuildAndChannel">get</button><br>
        <input id="guildId" type="text" placeholder="Guild ID" priv>
        <input id="channelId" type="text" placeholder="Channel ID" priv></span>
        <label><input id="includeNsfw" type="checkbox">NSFW Channel</label>
        <br>
        <span>Data
        <a href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/messageId.md" title="Help" target="_blank">?</a>
        <br>
        <input id="minDate" type="datetime-local" title="After" style="width:auto;">
        <input id="maxDate" type="datetime-local" title="Before" style="width:auto;">
        <input id="minId" type="text" placeholder="Depois da mensagem com Id" priv>
        <input id="maxId" type="text" placeholder="Antes da mensagem com Id" priv>
        <button id="import">Importar<input id="file" type="file" accept="application/json,.json"></button>
        <input id="file" type="file" accept="application/json,.json"></span>
        </div>
        <div style="display:flex;flex-direction:column;">
                <span>Procurar Mensagem <a
                        href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/filters.md" title="Help"
                        target="_blank">?</a><br>
                    <input id="content" type="text" placeholder="Containing text" priv><br>
                    <label><input id="hasLink" type="checkbox">Tem: link</label><br>
                    <label><input id="hasFile" type="checkbox">Tem: arquivo</label><br>
                    <label><input id="includePinned" type="checkbox">Inclui pins</label>
                </span><br>
                <span>Search Delay <a
                href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/delay.md" title="Help"
                target="_blank">?</a><br>
                    <input id="searchDelay" type="number" value="100" step="100"><br>
                </span>
                <span>Delete Delay <a
                href="https://github.com/herrmannjob/deletarMensagensDiscord/blob/master/help/delay.md" title="Help"
                target="_blank">?</a><br>
                    <input id="deleteDelay" type="number" value="1000" step="100">
                </span>
            </div>
        </div>
            <hr>
            <button id="start" style="background:#43b581;width:80px;">Começar</button>
            <button id="stop" style="background:#f04747;width:80px;" disabled>Parar</button>
            <button id="clear" style="width:80px;">Clear log</button>
            <label><input id="autoScroll" type="checkbox" checked>Auto rolagem</label>
            <label title="Hide sensitive information for taking screenshots"><input id="redact" type="checkbox">Screenshot
                mode</label>
            <progress id="progress" style="display:none;"></progress> <span class="percent"></span>
        </div>
        <pre class="logarea">
            <center>Avalie este projeto no <a href="https://github.com/herrmannjob/deletarMensagensDiscord" target="_blank">github.com/herrmannjob/deletarMensagensDiscord</a>!\n\n
                <a href="https://github.com/herrmannjob/deletarMensagensDiscord/issues" target="_blank">Problemas ou ajuda</a>
            </center>
        </pre>
    </div>
    `);

    document.body.appendChild(popover);

    btn = createElm(`<div id="undicord-btn" tabindex="0" role="button" aria-label="Delete Messages" title="Delete Messages">
    <svg aria-hidden="false" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z"></path>
        <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z"></path>
    </svg>
    <br><progress style="display:none; width:24px;"></progress>
</div>`);

    btn.onclick = function togglePopover() {
        if (popover.style.display !== 'none') {
            popover.style.display = 'none';
            btn.style.color = 'var(--interactive-normal)';
        }
        else {
            popover.style.display = '';
            btn.style.color = '#f04747';
        }
    };

    function mountBtn() {
        const toolbar = document.querySelector('[class^=toolbar]');
        if (toolbar) toolbar.appendChild(btn);
    }

    const observer = new MutationObserver(function (_mutationsList, _observer) {
        if (!document.body.contains(btn)) mountBtn(); // re-mount the button to the toolbar
    });
    observer.observe(document.body, { attributes: false, childList: true, subtree: true });

    mountBtn();

    const $ = s => popover.querySelector(s);
    const logArea = $('pre');
    const startBtn = $('button#start');
    const stopBtn = $('button#stop');
    const autoScroll = $('#autoScroll');

    startBtn.onclick = async e => {
        const authToken = $('input#authToken').value.trim();
        const authorId = $('input#authorId').value.trim();
        const guildId = $('input#guildId').value.trim();
        const channelIds = $('input#channelId').value.trim().split(/\s*,\s*/);
        const minId = $('input#minId').value.trim();
        const maxId = $('input#maxId').value.trim();
        const minDate = $('input#minDate').value.trim();
        const maxDate = $('input#maxDate').value.trim();
        const content = $('input#content').value.trim();
        const hasLink = $('input#hasLink').checked;
        const hasFile = $('input#hasFile').checked;
        const includeNsfw = $('input#includeNsfw').checked;
        const includePinned = $('input#includePinned').checked;
        const searchDelay = parseInt($('input#searchDelay').value.trim());
        const deleteDelay = parseInt($('input#deleteDelay').value.trim());
        const progress = $('#progress');
        const progress2 = btn.querySelector('progress');
        const percent = $('.percent');

        const fileSelection = $("input#file");
        fileSelection.addEventListener("change", () => {
            const files = fileSelection.files;
            const channelIdField = $('input#channelId');
            if (files.length > 0) {
                const file = files[0];
                file.text().then(text => {
                    let json = JSON.parse(text);
                    let channels = Object.keys(json);
                    channelIdField.value = channels.join(",");
                });
            }
        }, false);

        const stopHndl = () => !(stop === true);

        const onProg = (value, max) => {
            if (value && max && value > max) max = value;
            progress.setAttribute('max', max);
            progress.value = value;
            progress.style.display = max ? '' : 'none';
            progress2.setAttribute('max', max);
            progress2.value = value;
            progress2.style.display = max ? '' : 'none';
            percent.innerHTML = value && max ? Math.round(value / max * 100) + '%' : '';
        };


        stop = stopBtn.disabled = !(startBtn.disabled = true);
        for (let i = 0; i < channelIds.length; i++) {
            await deleteMessages(authToken, authorId, guildId, channelIds[i], minId || minDate, maxId || maxDate, content, hasLink, hasFile, includeNsfw, includePinned, searchDelay, deleteDelay, logger, stopHndl, onProg);
            stop = stopBtn.disabled = !(startBtn.disabled = false);
        }
    };
    stopBtn.onclick = e => stop = stopBtn.disabled = !(startBtn.disabled = false);
    $('button#clear').onclick = e => { logArea.innerHTML = ''; };
    $('button#getToken').onclick = e => {
        window.dispatchEvent(new Event('beforeunload'));
        const ls = document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage;
        $('input#authToken').value = JSON.parse(localStorage.token);
    };
    $('button#getAuthor').onclick = e => {
        $('input#authorId').value = JSON.parse(localStorage.user_id_cache);
    };
    $('button#getGuildAndChannel').onclick = e => {
        const m = location.href.match(/channels\/([\w@]+)\/(\d+)/);
        $('input#guildId').value = m[1];
        $('input#channelId').value = m[2];
    };
    $('#redact').onchange = e => {
        popover.classList.toggle('redact') &&
            window.alert('This will attempt to hide personal information, but make sure to double check before sharing screenshots.');
    };

    const logger = (type = '', args) => {
        const style = { '': '', info: 'color:#00b0f4;', verb: 'color:#72767d;', warn: 'color:#faa61a;', error: 'color:#f04747;', success: 'color:#43b581;' }[type];
        logArea.insertAdjacentHTML('beforeend', `<div style="${style}">${Array.from(args).map(o => typeof o === 'object' ? JSON.stringify(o, o instanceof Error && Object.getOwnPropertyNames(o)) : o).join('\t')}</div>`);
        if (autoScroll.checked) logArea.querySelector('div:last-child').scrollIntoView(false);
    };

    // fixLocalStorage
    window.localStorage = document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage;

}

initUI();


//END.
