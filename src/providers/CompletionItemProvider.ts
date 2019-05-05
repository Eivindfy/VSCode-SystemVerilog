
import * as vscode from 'vscode';
import { SystemVerilogWorkspaceSymbolProvider } from './WorkspaceSymbolProvider';
import { SystemVerilogDocumentSymbolProvider } from './DocumentSymbolProvider';

export class SystemVerilogCompletionItemProvider implements vscode.CompletionItemProvider {
    private workspaceSymProvider: SystemVerilogWorkspaceSymbolProvider;
    private docSymProvider: SystemVerilogDocumentSymbolProvider;

    constructor(workspaceSymProvider: SystemVerilogWorkspaceSymbolProvider, docSymProvider : SystemVerilogDocumentSymbolProvider) {
        this.workspaceSymProvider = workspaceSymProvider;
        this.docSymProvider = docSymProvider;
    };

    //Entrypoint for getting completion items 
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[]>{
        return new Promise((resolve, reject) => {
            var completionItems:vscode.CompletionItem[] =  [];
            
            var lookupRange = document.getWordRangeAtPosition(position);
            var lookupTerm = document.getText(lookupRange);

            // get all DocumentSymbolproviders and step to each of them 
            vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider",document.uri).then((symbols: vscode.SymbolInformation[]) => {
                symbols.forEach((value: vscode.SymbolInformation) => {
                    var results = value.containerName;
               //     console.log(results);
       //             completionItems.push(this.constructModuleItem(value, document));
//                    return resolve(completionItems);
                });
            });
            
            this.workspaceSymProvider.provideWorkspaceSymbols(lookupTerm, token, false).then((symbols: vscode.SymbolInformation[]) => {
                symbols.forEach((value: vscode.SymbolInformation) => {
                    if(value.kind = vscode.SymbolKind.Module){
                        completionItems.push(this.constructModuleItem(value));

                    }
                }, completionItems);
                resolve(completionItems);
            });
        });
    }


    // Contruct completion item for all system verilog module items
    constructModuleItem(symbol: vscode.SymbolInformation): vscode.CompletionItem {
        var completionItem = new vscode.CompletionItem(symbol.name, vscode.CompletionItemKind.Module);
        completionItem.filterText = symbol.name;
        completionItem.insertText = symbol.containerName;


        return completionItem;
    }

    resolveCompletionItem(item:vscode.CompletionItem, token:vscode.CancellationToken): vscode.CompletionItem {

        var descMarkdownString = new vscode.MarkdownString();
        descMarkdownString.appendCodeblock(this.workspaceSymProvider.modules[item.label+item.insertText].toString(), "systemverilog");
        item.documentation = descMarkdownString;

        item.insertText = new vscode.SnippetString(this.createModuleInsertionText(item));
        return item;
    };



    createModuleInsertionText(item: vscode.CompletionItem) : string {

        var rawText = this.workspaceSymProvider.modules[item.label+item.insertText];
        var text = rawText.replace(/\/\*[\s\S]*?\*\/|([\\:]|^)\/\/.*$/gm, '');
        var hasParameters = 0;
        var parameters = [];
        var insertText = "";
        var tabstopCnt = 2;

        if (text.indexOf("#") > -1){
            hasParameters = 1;
            parameters = text.slice(text.indexOf("(") + 1, text.indexOf(")")).split(",");
        }
        var signals = text.slice(text.lastIndexOf("(") + 1, text.lastIndexOf(")")).split(",");

        // Extracting list of parameters
        if(hasParameters ){
            for(var i = 0; i < parameters.length; i++){
                var splitParameter = parameters[i].trim().replace(/\[(.*?)\]/,"").split(/ +/);
                var p = splitParameter[splitParameter.length - 1];
                parameters[i] = p;
            }
        }
        
        // Extracting list of signals
        for(var i = 0; i < signals.length; i++){
            var splitSignal = signals[i].trim().replace(/\[(.*?)\]/,"").split(/ +/);
            var s = splitSignal[splitSignal.length - 1];
            signals[i] = s;
        }

        // Creatign the insertText based on the module name parameters and signals
        insertText = item.label;
        if (hasParameters){
            insertText = insertText +  + hasParameters ? "  #(\n" : "";
            for(var i = 0; i < parameters.length; i++ ){
                if (i != 0){
                    insertText = insertText + ",\n";
                }
                insertText = insertText + "\t." + parameters[i] + "($" + tabstopCnt.toString() + ")";
                tabstopCnt++;
            }
            insertText = insertText + "\n)";
        }
        
        insertText = insertText + "  $1 (\n";
        for(var i = 0; i < signals.length; i++ ){
            if (i != 0){
                insertText = insertText + ",\n";
            }
            insertText = insertText + "\t." + signals[i] + "($" + tabstopCnt.toString() + ")";
            tabstopCnt++;
        }
        insertText = insertText + "\n);";
        return insertText;
    };
};
