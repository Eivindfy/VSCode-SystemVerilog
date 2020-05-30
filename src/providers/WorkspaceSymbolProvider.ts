import { WorkspaceSymbolProvider, CancellationToken } from 'vscode';
import { SystemVerilogIndexer } from '../indexer';
import { getSymbolKind, SystemVerilogSymbol } from '../symbol';


export class SystemVerilogWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
    /*
    * this.symbols: filePath => Array<SystemVerilogSymbol>
    * each entry's key represents a file path,
    * and the entry's value is a list of the symbols that exist in the file
    */
    public indexer: SystemVerilogIndexer;
    public NUM_FILES: number = 250;

    constructor(indexer: SystemVerilogIndexer) {
        this.indexer = indexer;
    };

    /**
        Queries a symbol from `this.symbols`, performs an exact match if `exactMatch` is set to true,
        and a partial match if it's not passed or set to false.

        @param query the symbol's name, if it is prepended with a ¤ it signifies an exact match
        @param token the CancellationToken
        @return an array of matching SystemVerilogSymbol
    */
    public provideWorkspaceSymbols(query: string, token: CancellationToken): Thenable<Array<SystemVerilogSymbol>> {
        return new Promise((resolve, reject) => {
            if (query==undefined || query.length === 0) {
                resolve(this.indexer.mostRecentSymbols);
            } else {
                const pattern = new RegExp(".*" + query.replace(" ", "").split("").map((c) => c).join(".*") + ".*", 'i');
                let results = new Array<SystemVerilogSymbol>();
                let exactMatch: Boolean = false;
                if (query.startsWith("¤")) {
                    exactMatch = true
                    query = query.substr(1)
                }
                this.indexer.symbols.forEach(list => {
                    list.forEach(symbol => {
                        if (exactMatch === true) {
                            if (symbol.name == query) {
                                results.push(symbol);
                            }
                        }
                        else if (symbol.name.match(pattern)) {
                            results.push(symbol)
                        }
                    });
                });

                this.indexer.updateMostRecentSymbols(results.slice(0)); //pass a shallow copy of the array
                resolve(results);
            }
        });
    }

    /**
        Queries a `module` with a given name from `this.symbols`, performs an exact match if `exactMatch` is set to true,
        and a partial match if it's not passed or set to false.
        @param query the symbol's name
        @return the module's SystemVerilogSymbol
    */
    public provideWorkspaceModule(query: string): SystemVerilogSymbol {
        if (query.length === 0) {
            return undefined;
        } else {
            let symbolInfo = undefined;
            this.indexer.symbols.forEach(list => {
                list.forEach(symbol => {
                    if (symbol.name == query && symbol.kind == getSymbolKind("module")) {
                        symbolInfo = symbol;
                        return false;
                    }
                });

                if (symbolInfo) {
                    return false;
                }
            });

            this.indexer.updateMostRecentSymbols([symbolInfo]);
            return symbolInfo;
        }
    }

    private async provideSymbolsFromFile(uri: Uri): Promise<any> {
        return new Promise( (resolve, reject) => {
            workspace.openTextDocument(uri).then( doc => {
                for (let linenr = 0; linenr<doc.lineCount; linenr++) {
                    let line = doc.lineAt(linenr);
                    let match = this.regex.exec(line.text);
                    if (match) {
                        var symbolLocation =new Location(doc.uri,
                                                         new Range(
                                                                   linenr, line.text.indexOf(match[2]),
                                                                   linenr, line.text.indexOf(match[2])+match[2].length));

                        this.symbols.push( new SymbolInformation(
                            match[2], getSymbolKind(match[1]), doc.fileName, symbolLocation ));
                        if(getSymbolKind(match[1]) == SymbolKind.Module){
                            this.buildModuleInformation(match[2], symbolLocation, doc);
                        }
                    }
                }
                resolve();
            }, err => {
                console.log("SystemVerilog: Indexing: Unable to open file: ", uri.toString());
                resolve();
            });
        });
    }

    private buildModuleInformation(name: String, location: Location, doc : TextDocument){

        var startPoint = new Position(location.range.start.line, doc.lineAt(location.range.start).firstNonWhitespaceCharacterIndex);
        

        // Getting the endpoint of the module instantiation, includes the Name, the parameter list and the signal interface
        var docSize = doc.lineCount;
        var multiLineComment = 0;
        var endPoint = location.range.end; 
        for( var i = location.range.end.line; i < docSize; i++){
            var line = doc.lineAt(i).text.toString();
            // Removing comments 
            line = line.replace(/\/\*[\s\S]*?\*\/|([\\:]|^)\/\/.*$/gm, '*/');
            if (multiLineComment && line.indexOf("*/") > -1){
                line = line.slice(line.indexOf("*/"), -1);
                multiLineComment = 0;
            }
            if (multiLineComment) {
                line = "";
            }
            if (!multiLineComment && line.indexOf("//") > -1){
                line = line.split("//")[0];
            } 
            if(line.indexOf("/*") > -1){
                line = line.slice(0, line.indexOf("/*"));
                multiLineComment = 1;
            }
            // finding first instance of ";" ending the module port list definition
            if(line.indexOf(";") > -1){
                endPoint = new Position(i, line.indexOf(";") + 1);
                break;
            }
        }

        var range = new Range(startPoint, endPoint);
        this.modules[name.toString() + doc.fileName] = doc.getText(range);

    }
}
