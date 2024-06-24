const vscode = require('vscode');

function activate(context) {

    let disposable = vscode.commands.registerCommand('schema-path-generator.SchemaPathGenerator', async function () {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const document = editor.document;
            const json = document.getText();
            let jsonObject;

            // loading Json
            try {
                jsonObject = JSON.parse(json);
            } catch (error) {
                vscode.window.showErrorMessage('Error parsing JSON');
                return;
            }

            const selection = editor.selection;
            let selectedAttribute = selection.isEmpty ? '' : document.getText(selection);

            if (selectedAttribute) {
                await findSelectedAttributePaths(jsonObject, selectedAttribute);
            } else {
                await promptForAttributeNameAndHandle(jsonObject);
            }
        }
    });

    context.subscriptions.push(disposable);
}


// functions
function findPaths(data, targetPhrase) {
    let result = [];

    function traverse(propAttribute, currPath) {
        if (propAttribute.properties) {
            for (const attribute in propAttribute.properties) {
                const newPath = [...currPath, attribute];
                traverse(propAttribute.properties[attribute], newPath);
            }
        } else if (propAttribute.items) {
            const newPath = currPath;
            traverse(propAttribute.items, newPath);
        }

        // Check if the target phrase is in the current path
        if (currPath.includes(targetPhrase)) {
            result.push(currPath);
        }
    }

    traverse(data.Content, []);

    result = [...new Set(result.reverse())]; // remove duplicates
    return result;
}

async function findSelectedAttributePaths(jsonObject, selectedAttribute) {
    const paths = findPaths(jsonObject, selectedAttribute);
    // TODO: find selected Attribute path (just that 1, not all paths with selected name)
    if (paths.length === 0) {
        vscode.window.showInformationMessage(`No attribute found with name: ${selectedAttribute}`);
    } else {
        await displayPaths(paths);
    }
}

async function promptForAttributeNameAndHandle(jsonObject) {
    const attributeName = await vscode.window.showInputBox({
        prompt: 'Enter attribute name'
    });

    if (attributeName) {
        const paths = findPaths(jsonObject, attributeName);
        if (paths.length === 0) {
            vscode.window.showInformationMessage(`No attribute found with name: ${attributeName}`);
        } else {
            await displayPaths(paths);
        }
    }
}

async function displayPaths(paths) {
    const pathOptions = paths.map(path => ({
        label: arrayToString(path),
        detail: `Click to copy: ${arrayToString(path)}`
    }));

    const selectedPath = await vscode.window.showQuickPick(pathOptions, {
        placeHolder: 'Select path to copy',
        matchOnDetail: true
    });

    if (selectedPath) {
        await vscode.env.clipboard.writeText(selectedPath.label);
        vscode.window.showInformationMessage(`Copied to clipboard: ${selectedPath.label}`);
    }
}

function arrayToString(arr) {
    return `['${arr.join("']['")}']`;
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
