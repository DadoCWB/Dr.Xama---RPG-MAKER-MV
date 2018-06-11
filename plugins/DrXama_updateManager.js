//==================================================================================================
// DrXama_updateManager.js
//==================================================================================================
/*:
 * @plugindesc v2.00 - Gerenciador de atualizações
 *
 * @author Dr.Xamã
 * 
 * @param Arquivo de atualizações
 * @desc Url para baixar o arquivo e verificar novas atualizações
 * - Recomendo o raw do github.
 * @type string
 * @default https://raw.githubusercontent.com/GS-GAME-WORDS/Dr.Xama---RPG-MAKER-MV/master/DrXama_updateManager/updateManager.json
 * 
 * @help
 * ================================================================================
 *    Introdução
 * ================================================================================
 * Tenha um gerenciamento de atualizações eficiente, agora você pode atualizar seu
 * jogo quando quiser.
 * ================================================================================
 *    Atualização
 * ================================================================================
 * Para atualizar esse plugin vá no github do Dr.Xamã
 * http://drxama.epizy.com/?page_id=299
 */
(function () {
    "use strict";
    //-----------------------------------------------------------------------------
    // Parâmetros
    //
    const params = PluginManager.parameters('DrXama_updateManager'),
        updateFile = String(params['Arquivo de atualizações']),
        fs = require('fs');

    //-----------------------------------------------------------------------------
    // Variaveis Globais
    //

    /**
     * @description Verifica se a scene foi reiniciada
     */
    var scene_system_reload = null;

    /**
     * @description Salva as funções para o progresso da janela
     */
    var windowProgress = (function () {
        return {
            files: 0,
            progress: false,
            add() {
                this.files++;
            },
            remove() {
                this.files--;
            },
            update() {
                if (!this.progress) {
                    this.progress = true;
                    require('nw.gui').Window.get().setProgressBar(1.5);
                } else {
                    if (this.files <= 0) {
                        this.progress = false;
                        require('nw.gui').Window.get().setProgressBar(0);
                    }
                }
            }
        }
    })();

    /**
     * @description Salva a janela do progresso de download
     */
    var windowDownloadProgress = (function () {
        return {
            fileName: null,
            progressText: null,
            progressMax: 0,
            progress: 0,
            progressBar: 0,
            resetProgress() {
                this.fileName = null;
                this.progressText = null;
                this.progress = 0;
                this.progressBar = 0;
            },
            setTextBar(text) {
                this.progressText = text;
            },
            getTextBar() {
                return this.progressText ? this.progressText : '0 KB / 0 KB';
            },
            setTextFile(text) {
                this.fileName = text;
            },
            getTextFile() {
                return this.fileName ? this.fileName : '???';
            },
            setProgressMax(max) {
                this.progressMax = Math.floor(max);
            },
            setProgress(value) {
                if (this.progress < Math.floor(value))
                    this.progress = Math.floor(value);
            },
            setProgressBar(value) {
                value = Math.floor(value * this.progressMax / 100);
                if (this.progressBar < value)
                    this.progressBar = value;
            },
            getProgress() {
                return this.progress > this.progressMax ? this.progressMax : this.progress;
            },
            getProgressBar() {
                return this.progressBar > this.progressMax ? this.progressMax : this.progressBar;
            }
        }
    })();

    //-----------------------------------------------------------------------------
    // Scene_Boot
    //
    const __scene_boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function () {
        if (!roster_downloadsComplete) {
            initializeSystem();
            this.drawLoadUpdate();
        } else {
            __scene_boot_start.call(this);
        }
    };

    Scene_Boot.prototype.updateDownloadComplete = function () {
        this._updateDownloadComplete = true;
    };

    const Scene_Boot_update = Scene_Boot.prototype.update;
    Scene_Boot.prototype.update = function () {
        Scene_Boot_update.call(this);
        if (!scene_system_reload) {
            this.updateProgressBar();
            this.updateLoadUpdate();
            updateDownloadToRoster();
        }
    };

    Scene_Boot.prototype.drawLoadUpdate = function () {
        this._loadUpdateSprite = [
            new Sprite(),
            new Sprite(),
            new Sprite(),
            new Sprite(),
            new Sprite(),
            new Sprite()
        ];
        // Sprite 1
        this._loadUpdateSprite[0].bitmap = new Bitmap(Graphics.width, Graphics.height);
        this._loadUpdateSprite[0].bitmap.fillAll('black');
        // Sprite 2
        this._loadUpdateSprite[1].bitmap = ImageManager.loadSystem('Downloading');
        this._loadUpdateSprite[1].x = Graphics.width / 2;
        this._loadUpdateSprite[1].y = Graphics.height / 2;
        this._loadUpdateSprite[1].anchor.x = 0.5;
        this._loadUpdateSprite[1].anchor.y = 0.5;
        // Sprite 3
        this._loadUpdateSprite[2].bitmap = new Bitmap(Graphics.width - 20, 20);
        this._loadUpdateSprite[2].bitmap.fillAll('#d9d9d9');
        this._loadUpdateSprite[2].x = Graphics.width / 2;
        this._loadUpdateSprite[2].y = Graphics.height - 20;
        this._loadUpdateSprite[2].anchor.x = 0.5;
        this._loadUpdateSprite[2].anchor.y = 0.5;
        // Sprite 4
        this._loadUpdateSprite[3].bitmap = new Bitmap(Graphics.width - 20, 20);
        this._loadUpdateSprite[3].bitmap.fillRect(0, 0, 800, 20, '#66ff33');
        this._loadUpdateSprite[3].x = Graphics.width / 2;
        this._loadUpdateSprite[3].y = Graphics.height - 20;
        this._loadUpdateSprite[3].anchor.x = 0.5;
        this._loadUpdateSprite[3].anchor.y = 0.5;
        windowDownloadProgress.setProgressMax(800);
        // Sprite 5
        this._loadUpdateSprite[4].bitmap = new Bitmap(Graphics.width - 20, 80);
        this._loadUpdateSprite[4].bitmap.fontSize = 24;
        this._loadUpdateSprite[4].bitmap.drawText(windowDownloadProgress.getTextFile(), 0, 20, Graphics.width - 20, 0, 'center');
        this._loadUpdateSprite[4].x = Graphics.width / 2;
        this._loadUpdateSprite[4].y = Graphics.height - 50;
        this._loadUpdateSprite[4].anchor.x = 0.5;
        this._loadUpdateSprite[4].anchor.y = 0.5;
        // Sprite 6
        this._loadUpdateSprite[5].bitmap = new Bitmap(Graphics.width - 20, 80);
        this._loadUpdateSprite[5].bitmap.fontSize = 18;
        this._loadUpdateSprite[5].bitmap.drawText(windowDownloadProgress.getTextBar(), 0, 20, Graphics.width - 20, 0, 'center');
        this._loadUpdateSprite[5].x = Graphics.width / 2;
        this._loadUpdateSprite[5].y = Graphics.height - 25;
        this._loadUpdateSprite[5].anchor.x = 0.5;
        this._loadUpdateSprite[5].anchor.y = 0.5;
        this.addChild(this._loadUpdateSprite[0]);
        this.addChild(this._loadUpdateSprite[1]);
        this.addChild(this._loadUpdateSprite[2]);
        this.addChild(this._loadUpdateSprite[3]);
        this.addChild(this._loadUpdateSprite[4]);
        this.addChild(this._loadUpdateSprite[5]);
    };

    Scene_Boot.prototype.updateProgressBar = function () {
        this._loadUpdateSprite[3].bitmap.clear();
        this._loadUpdateSprite[4].bitmap.clear();
        this._loadUpdateSprite[5].bitmap.clear();
        this._loadUpdateSprite[3].bitmap.fillRect(0, 0, windowDownloadProgress.getProgressBar(), 20, '#66ff33');
        this._loadUpdateSprite[4].bitmap.drawText(windowDownloadProgress.getTextFile(), 0, 20, Graphics.width - 20, 0, 'center');
        this._loadUpdateSprite[5].bitmap.drawText(windowDownloadProgress.getTextBar(), 0, 20, Graphics.width - 20, 0, 'center');
    };

    Scene_Boot.prototype.updateLoadUpdate = function () {
        if (this._updateDownloadComplete) {
            var fadeOut = false;
            this._loadUpdateSprite.map(function (sprite) {
                if (sprite.opacity > 0) {
                    fadeOut = false
                    sprite.opacity -= 4;
                }
                else
                    fadeOut = true;
            });
            if (fadeOut) {
                scene_system_reload = true;
                SceneManager.goto(Scene_Boot);
            }
            return;
        }
        if (this._loadUpdateSpriteFrames == undefined) {
            this._loadUpdateSpriteFrames = [30, 35];
        }
        if (this._loadUpdateSpriteFrames[0] > 0) {
            this._loadUpdateSpriteFrames[0] -= 0.60;
            if (this._loadUpdateSprite[1].opacity > 0) {
                this._loadUpdateSprite[1].opacity -= 4;
            }
        } else {
            if (this._loadUpdateSpriteFrames[1] > 0) {
                this._loadUpdateSpriteFrames[1] -= 0.60;
                if (this._loadUpdateSprite[1].opacity < 255) {
                    this._loadUpdateSprite[1].opacity += 4;
                }
            } else {
                this._loadUpdateSpriteFrames = undefined;
            }
        }
    };

    //-----------------------------------------------------------------------------
    // Roster(Lista) de downloads
    // 
    var roster_data = (function () {
        var folderRoster = String('system/update/save'),
            fileRoster = `${folderRoster}\\downloadroster.drxamasave`,
            fileData = {};
        if (fs.existsSync(localPath(fileRoster)))
            fileData = JSON.parse(LZString.decompressFromBase64(fs.readFileSync(localPath(fileRoster), { encoding: 'utf8' })));
        return fileData;
    })(),
        roster_initialized = null,
        roster_updateData = null,
        roster_downloadsComplete = null;

    /**
     * @description Adiciona o arquivo a lista de downloads
     * @param {String} fileUrl Link do arquivo
     * @param {String} fileName Nome do arquivo
     * @param {String} fileType Tipo do arquivo
     * @param {String} fileVersion Versão do arquivo
     * @param {String} filePath Caminho do arquivo
     */
    function addDownloadToRoster(fileUrl, fileName, fileType, fileVersion, filePath) {
        var folderRoster = String('system/update/save'),
            fileRoster = `${folderRoster}\\downloadroster.drxamasave`,
            fileData = roster_data;
        if (!localPathExists(folderRoster))
            localPathCreate(folderRoster);
        if (fs.existsSync(localPath(fileRoster))) {
            if (!fileData[fileName])
                fileData[fileName] = {};
            if (fileData[fileName]['url'] === undefined)
                fileData[fileName]['url'] = fileUrl;
            if (fileData[fileName]['name'] === undefined)
                fileData[fileName]['name'] = fileName;
            if (fileData[fileName]['type'] === undefined)
                fileData[fileName]['type'] = fileType;
            if (fileData[fileName]['version'] === undefined ||
                fileData[fileName]['version'] != fileVersion)
                fileData[fileName]['version'] = fileVersion;
            if (fileData[fileName]['path'] === undefined ||
                fileData[fileName]['path'] != filePath)
                fileData[fileName]['path'] = filePath;
            if (fileData[fileName]['download'] === undefined)
                fileData[fileName]['download'] = false;
        } else {
            fileData[fileName] = {
                url: fileUrl,
                name: fileName,
                type: fileType,
                version: fileVersion,
                path: filePath,
                download: false
            };
        }
        fs.writeFileSync(localPath(fileRoster), LZString.compressToBase64(JSON.stringify(fileData)), { encoding: 'utf8' });
    };

    /**
     * @description Completa o download da lista de downloads
     * @param {String} fileName Nome do arquivo
     * @param {String} filePath Caminho do arquivo
     * @param {String} fileVersion Versão do arquivo
     */
    function completeDownloadToRoster(fileName, filePath, fileVersion) {
        var folderRoster = String('system/update/save'),
            fileRoster = `${folderRoster}\\downloadroster.drxamasave`,
            fileData = roster_data;
        if (fs.existsSync(localPath(fileRoster))) {
            if (fileData[fileName]) {
                fileData[fileName]['version'] = fileVersion;
                fileData[fileName]['download'] = true;
            }
            // Move o arquivo para a pasta destino
            if (typeof filePath == 'string' && filePath.length > 0) {
                var downloadFolder = String('system/update/download');
                if (fs.existsSync(localPath(downloadFolder))) {
                    if (!localPathExists(filePath))
                        localPathCreate(filePath);
                    var name = fileData[fileName]['name'],
                        type = fileData[fileName]['type'],
                        src = localPath(`${downloadFolder}\\${name}.${type}`),
                        dest = localPath(`${filePath}\\${name}.${type}`);
                    if (fs.existsSync(src)) {
                        var file = fs.createReadStream(src).pipe(fs.createWriteStream(dest));
                        file.on('finish', function () {
                            file.close();
                            if (fs.existsSync(src))
                                fs.unlinkSync(src);
                        });
                    }
                }
            }
            fs.writeFileSync(localPath(fileRoster), LZString.compressToBase64(JSON.stringify(fileData)), { encoding: 'utf8' });
            roster_initialized = null;
        }
    };

    /**
     * @description Atualiza a lista de downloads
     */
    function updateDownloadToRoster() {
        var folderRoster = String('system/update/save'),
            fileRoster = `${folderRoster}\\downloadroster.drxamasave`,
            fileData = roster_data,
            fileUpdatePath = String('system/update/download'),
            fileUpdate = `${fileUpdatePath}\\updateManager.json`;
        if (fs.existsSync(localPath(fileRoster))) {
            if (!roster_initialized) {
                // Arquivo de atualizações
                if (fs.existsSync(localPath(fileUpdate))) {
                    if (fileData['updateManager'] && !fileData['updateManager']['download'])
                        return;
                    else {
                        fileData['updateManager'] = null;
                        fs.writeFileSync(localPath(fileRoster), LZString.compressToBase64(JSON.stringify(fileData)), { encoding: 'utf8' });
                    }
                    try {
                        roster_updateData = JSON.parse(fs.readFileSync(localPath(fileUpdate), { encoding: 'utf8' }));
                    } catch (error) {
                        return;
                    }
                    if (roster_updateData['Arquivos'] instanceof Array &&
                        roster_updateData['Arquivos'].length > 0) {
                        roster_updateData['Arquivos'].map(function (file) {
                            let url = file['link'],
                                nome = file['nome'],
                                type = file['tipo'],
                                path = file['pasta'],
                                version = file['versão'];
                            if (fileData[nome] === undefined) fileData[nome] = {};
                            if (fileData[nome]['version'] != version || !fs.existsSync(localPath(`${path}\\${nome}.${type}`))) {
                                addDownloadToRoster(url, nome, type, version, path);
                            }
                        });
                    }
                    if (fs.existsSync(localPath(fileUpdate)))
                        fs.unlinkSync(localPath(fileUpdate));
                    return;
                }
                roster_downloadsComplete = false;
                var keys = Object.keys(fileData),
                    i = 0,
                    length = keys.length;
                for (; i < length; i++) {
                    let key = keys[i];
                    if (fileData[key] && !fileData[key]['download']) {
                        let url = fileData[key]['url'],
                            name = fileData[key]['name'],
                            type = fileData[key]['type'],
                            version = fileData[key]['version'],
                            path = fileData[key]['path'];
                        roster_initialized = true;
                        return downloadFile(url, name, type, version, path);
                    } else {
                        if (i != 'updateManager') {
                            if (fileData[key] && fileData[key]['download']) {
                                roster_downloadsComplete = true;
                            } else {
                                roster_downloadsComplete = false;
                            }
                        }
                    }
                };
                if (roster_downloadsComplete)
                    completeAllDownloads();
            }
        }
    };

    //-----------------------------------------------------------------------------
    // Funções
    //

    /**
     * @description Inicia o sistema
     */
    function initializeSystem() {
        downloadUpdateFile();
    };

    /**
     * @description Chamada quando todos os downloads estão completos
     */
    function completeAllDownloads() {
        if (SceneManager._scene instanceof Scene_Boot)
            SceneManager._scene.updateDownloadComplete();
    };

    /**
     * @description Baixa o arquivo de atualização
     */
    function downloadUpdateFile() {
        return addDownloadToRoster(updateFile, 'updateManager', 'json');
    };

    /**
     * @description Retorna o caminho local para o arquivo/pasta
     */
    function localPath(p) {
        // Retira uma parte da string
        if (p.substring(0, 1) === '/') p = p.substring(1);
        // Importa o modulo PATH do Node
        var path = require('path');
        // Cria a base para o caminho local
        var base = path.dirname(process.mainModule.filename);
        // Retorna a base do caminho associado ao caminho
        return path.join(base, p);
    };

    /**
     * @description Verifica se o caminho local existe
     */
    function localPathExists(p) {
        var fs = require('fs'),
            i = 0,
            length = p.length,
            path = false,
            paths = [],
            pathString = '';
        for (; i < length; i++) {
            let letter = String(p[i]);
            if (letter != '/') {
                pathString += letter;
            }
            if (letter == '/' || i == length - 1) {
                paths.push(pathString);
                var pathsJoin = paths.join("/");
                if (fs.existsSync(localPath(pathsJoin))) {
                    path = true;
                } else {
                    path = false;
                }
                pathString = '';
            }
        }
        return path;
    };

    /**
     * @description Cria o caminho local
     */
    function localPathCreate(p) {
        var fs = require('fs'),
            i = 0,
            length = p.length,
            paths = [],
            pathString = '';
        for (; i < length; i++) {
            let letter = String(p[i]);
            if (letter != '/') {
                pathString += letter;
            }
            if (letter == '/' || i == length - 1) {
                paths.push(pathString);
                var pathsJoin = paths.join("/");
                if (!fs.existsSync(localPath(pathsJoin))) {
                    fs.mkdirSync(localPath(pathsJoin));
                }
                pathString = '';
            }
        }
    };

    /**
     * @description Faz a formatação dos bytes
     */
    function formatBytes(bytes) {
        if (bytes == 0) return '0 Bytes';
        var k = 1024,
            dm = 2,
            sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    /**
     * @description Retorna o valor mais a quantidade de 0 indicada
     */
    function padZero(value, length) {
        var s = String(value);
        while (s.length < Number(length)) {
            s += '0';
        }
        return Number(s);
    };

    /**
     * @description Faz o download do arquivo
     * @param {String} fileUrl Link do arquivo
     * @param {String} fileName Nome do arquivo
     * @param {String} fileType Tipo do arquivo
     * @param {String} fileVersion Versão do arquivo
     * @param {String} filePath Caminho do arquivo
     */
    function downloadFile(fileUrl, fileName, fileType, fileVersion, filePath) {
        var http = null,
            fileUrl = String(fileUrl),
            folderDest = String('system/update/download');
        if (!localPathExists(folderDest))
            localPathCreate(folderDest);
        folderDest = localPath(folderDest);
        var fileDest = `${folderDest}\\${String(fileName)}.${String(fileType).toLowerCase()}`;
        if (fileUrl.substring(0, 5).match(/https/)) {
            http = require('https');
        } else {
            http = require('http');
        }
        if (fs.existsSync(folderDest)) {
            if (!fs.existsSync(fileDest))
                fs.writeFileSync(fileDest, '', { encoding: 'utf8' });
            var file = fs.createWriteStream(fileDest);
            var request = http.get(fileUrl, function (res) {
                res.pipe(file);
                windowProgress.add();
                windowProgress.update();
                res.on('data', function (data) {
                    var menor = formatBytes(res.socket.bytesRead),
                        maior = formatBytes(res.headers['content-length']),
                        total = padZero(res.headers['content-length'], 2),
                        corrent = res.socket.bytesRead,
                        porcent = corrent / total * 100;
                    windowDownloadProgress.setTextFile(`${fileName}(${windowDownloadProgress.getProgress()}%)`);
                    windowDownloadProgress.setTextBar(`${menor} / ${maior}`);
                    windowDownloadProgress.setProgress(porcent);
                    windowDownloadProgress.setProgressBar(porcent);
                }).on('end', function () {
                    console.log(fileName);
                    completeDownloadToRoster(fileName, filePath, fileVersion);
                    windowProgress.remove();
                    windowProgress.update();
                    windowDownloadProgress.resetProgress();
                });
            }).on('error', function (err) {
                fs.unlinkSync(fileDest);
            });
        }
    };
})();