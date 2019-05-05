import { SymbolInformation, Location, Range, WorkspaceSymbolProvider, CancellationToken, workspace, Uri, window, StatusBarItem, ProgressLocation, GlobPattern, SymbolKind, TextDocument, Position} from 'vscode';
import { getSymbolKind } from './DocumentSymbolProvider';

export class SystemVerilogWorkspaceSymbolProvider implements WorkspaceSymbolProvider {

    private regex = /^\s*(?:virtual\s+(?=class))?(module|class|interface|package|program(?:\s+automatic)?)\s+(\w+)/;
    public symbols: SymbolInformation[];
    public building: Boolean = false;
    public statusbar: StatusBarItem;
    
    public NUM_FILES: number = 250;
    public parallelProcessing = 100;
    public exclude: GlobPattern = undefined;
    public modules: { [id: string] : String; }= {};


    

    constructor(statusbar: StatusBarItem, disabled?: Boolean, exclude?: GlobPattern, parallelProcessing?: number) {
        this.statusbar = statusbar;
        if (disabled) {
            this.statusbar.text = "SystemVerilog: Indexing disabled"
        } else {
            if (exclude != "insert globPattern here") {
                this.exclude = exclude;
            }
            if (parallelProcessing) {
                this.parallelProcessing = parallelProcessing;
            }
            this.statusbar.text = "SystemVerilog: Indexing";
            this.build_index().then( res => this.statusbar.text = res );
        }
    };

    public dispose() {
        delete this.symbols
    }

    public provideWorkspaceSymbols(query: string, token: CancellationToken, exactMatch?: Boolean): Thenable<SymbolInformation[]> {
        let results: SymbolInformation[] = [];
        let query_regex = new RegExp(query, 'i');
        return new Promise( resolve  => {
            if (query == "") { // Show maximum 250 files for speedup
                resolve(this.symbols.slice(0, 250))
            } else {
                this.symbols.forEach( symbol => {
                    if (exactMatch) {
                        if (symbol.name == query) {
                            results.push(symbol);
                        }
                    } else if (symbol.name.match(query_regex)) {
                        results.push(symbol)
                    }
                }, results);
            }
            resolve(results);
        });
    }

    public async build_index(): Promise<any> {
        var cancelled = false;
        this.building = true;

        return await window.withProgress({
            location: ProgressLocation.Notification,
            title: "SystemVerilog Indexing",
            cancellable: true
        }, async (progress, token) => {
            this.symbols = new Array<SymbolInformation>();
            let uris = await Promise.resolve(workspace.findFiles('**/*.{sv,v,svh,vh}', this.exclude, undefined, token));

            for (var filenr = 0; filenr<uris.length; filenr+=this.parallelProcessing) {
                let subset = uris.slice(filenr, filenr+this.parallelProcessing)
                if (token.isCancellationRequested) {
                    cancelled = true;
                    break;
                }
                await Promise.all(subset.map( async (file) => {
                    return this.provideSymbolsFromFile(file);
                }));
            }
        }).then( () => {
            this.building = false;
            if (cancelled) {
                return "SystemVerilog: Indexing cancelled";
            } else {
                return 'Systemverilog: '+this.symbols.length+ ' indexed objects'
            }
        });
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
