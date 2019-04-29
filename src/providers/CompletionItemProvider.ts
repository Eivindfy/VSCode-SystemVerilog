
import * as vscode from 'vscode';
import { SystemVerilogWorkspaceSymbolProvider } from './WorkspaceSymbolProvider';
import { SystemVerilogDocumentSymbolProvider } from './DocumentSymbolProvider';

export class SystemVerilogCompletionItemProvider implements vscode.CompletionItemProvider {


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
                    completionItems.push(this.constructModuleItem(value, document));
                    return resolve(completionItems);
                });
            });

            vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", lookupTerm).then((symbols: vscode.SymbolInformation[]) => {
                symbols.forEach((value: vscode.SymbolInformation) => {
                    completionItems.push(this.constructModuleItem(value, document))
                    return resolve(completionItems);
                });
            });
        });
    }


    // Contruct completion item for all system verilog module items
    constructModuleItem(symbol: vscode.SymbolInformation, document: vscode.TextDocument): vscode.CompletionItem {
        var location = symbol.location;
        var name = symbol.name;
        var completionItem:vscode.CompletionItem = new vscode.CompletionItem(symbol.name, 12);
        var text = document.getText(location.range);
//        console.log(name);

        completionItem.detail = name;
        completionItem.filterText = name;
        completionItem.insertText = name;

        completionItem.documentation = text;

        return completionItem;
    }

//    resolveCompletionItem(item:vscode.CompletionItem, token:vscode.CancellationToken): vscode.CompletionItem {
//        var completionItem:vscode.CompletionItem = new vscode.CompletionItem("id");
//        completionItem.detail = "aaa";
//        completionItem.filterText = "aa";
//        completionItem.insertText = "aa";
//        return completionItem;
//    }
};
