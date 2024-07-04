const vscode = require('vscode');

function activate(context) {

    let disposable = vscode.commands.registerCommand('schema-path-generator.SchemaPathGenerator', async function () {
        const editor = vscode.window.activeTextEditor;
        const document = editor.document;

        if (editor) {
            const selection = editor.selection;
            let selectedAttribute = selection.isEmpty ? '' : document.getText(selection);

            if (selectedAttribute) {
                let selectionStartAt = selection.start;  // {c: 35, e: 13}
                const selectionEndsAt = selection.end;    // {c: 35, e: 23}

                const range = new vscode.Range(selectionStartAt, selectionEndsAt);

                // Get the document text copy
                let documentText = document.getText();

                // Edit json temporarily in memory: selectedAttribute -> :selectedAttribute
                let modifiedText = documentText.substring(0, document.offsetAt(range.start)) + ":" + selectedAttribute + documentText.substring(document.offsetAt(range.end));

                // Load json
                let jsonObject = loadJsonObject(modifiedText);

                // Find path for chosen attribute
                await findSelectedAttributePaths(jsonObject, ":" + selectedAttribute);
            } else {
                let documentText = document.getText();
                let jsonObject = loadJsonObject(documentText);
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

async function findSelectedAttributePaths(jsonObject, selectedAttributeNewName) {
    const paths = findPaths(jsonObject, selectedAttributeNewName);

    if (paths.length === 0) {
        selectedAttributeNewName = selectedAttributeNewName.replace(":", "");
        vscode.window.showInformationMessage(`No attribute found with name: ${selectedAttributeNewName}`);
    } else {
        // remove ":" from path
        let stringToCopy = arrayToString(paths[0]);
        stringToCopy = stringToCopy.replace(/:/g, "");

        // copy path to clipboard
        await vscode.env.clipboard.writeText(stringToCopy);
        vscode.window.showInformationMessage(`Copied to clipboard: ${stringToCopy}`);
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

function loadJsonObject(jsonText) {
    // Loading Json
    try {
        return JSON.parse(jsonText);
    } catch (error) {
        vscode.window.showErrorMessage('Error parsing JSON');
        return;
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
