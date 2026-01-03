import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

let sidebarProvider: SidebarProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Chitshare extension is now active!');

    // Create sidebar provider
    sidebarProvider = new SidebarProvider(context.extensionUri, context);

    // Register sidebar webview provider (Activity Bar)
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            }
        )
    );

    // Register Explorer chat view (same provider, different location)
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.explorerViewType,
            sidebarProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            }
        )
    );

    // Register login command
    context.subscriptions.push(
        vscode.commands.registerCommand('chitshare.login', () => {
            sidebarProvider.login();
        })
    );

    // Register logout command
    context.subscriptions.push(
        vscode.commands.registerCommand('chitshare.logout', () => {
            sidebarProvider.logout();
        })
    );

    // Register refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('chitshare.refresh', () => {
            sidebarProvider.refresh();
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('chitshare')) {
                // Refresh when settings change
                sidebarProvider.refresh();
            }
        })
    );
}

export function deactivate() {
    if (sidebarProvider) {
        sidebarProvider.dispose();
    }
}
