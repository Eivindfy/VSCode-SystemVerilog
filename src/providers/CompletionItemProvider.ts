
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
       //             completionItems.push(this.constructModuleItem(value, document));
//                    return resolve(completionItems);
                });
            });

            vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", lookupTerm).then((symbols: vscode.SymbolInformation[]) => {
                symbols.forEach((value: vscode.SymbolInformation) => {
                    vscode.workspace.openTextDocument(value.location.uri).then(doc => {
                        console.log(value.name)
                        console.log(value.location);
                        completionItems.push(this.constructModuleItem(value, doc));
                        return resolve(completionItems);
                    });
                });
            });
        });
    }


    // Contruct completion item for all system verilog module items
    constructModuleItem(symbol: vscode.SymbolInformation, document: vscode.TextDocument): vscode.CompletionItem {
        var location = symbol.location;
        var name = symbol.name;
        var completionItem:vscode.CompletionItem = new vscode.CompletionItem(symbol.name, 12);

        var startPoint = new vscode.Position(location.range.start.line, document.lineAt(location.range.start).firstNonWhitespaceCharacterIndex);
        

        // Getting the endpoint of the module instantiation, includes the Name, the parameter list and the signal interface
        var docSize = document.lineCount;
        var multiLineComment = 0;
        var endPoint = location.range.end; 
        for( var i = location.range.end.line; i < docSize; i++){
            var line = document.lineAt(i).text.toString();
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
                endPoint = new vscode.Position(i, line.indexOf(";") + 1);
                break;
            }
        }

        var range = new vscode.Range(startPoint, endPoint);
        var text = document.getText(range);

        completionItem.label = name;
        completionItem.filterText = name;
        completionItem.insertText = text;

        var myMarkdownString = new vscode.MarkdownString();
        myMarkdownString.appendCodeblock(text, "systemverilog");
        completionItem.documentation = myMarkdownString;

        return completionItem;
    }

    resolveCompletionItem(item:vscode.CompletionItem, token:vscode.CancellationToken): vscode.CompletionItem {



        item.insertText = this.createModuleInsertionText(item);
        return item;
    };



    createModuleInsertionText(item: vscode.CompletionItem) : string {

        var text = item.insertText.toString().replace(/\/\*[\s\S]*?\*\/|([\\:]|^)\/\/.*$/gm, '');
        var hasParameters = 0;
        var parameters = [];
        var insertText = "";

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
                insertText = insertText + "\t." + parameters[i] + "()";
            }
            insertText = insertText + "\n)";
        }
        
        insertText = insertText + "  __NAME__  (\n";
        for(var i = 0; i < signals.length; i++ ){
            if (i != 0){
                insertText = insertText + ",\n";
            }
            insertText = insertText + "\t." + signals[i] + "()";
        }
        insertText = insertText + "\n);";
        return insertText;
    };
};
