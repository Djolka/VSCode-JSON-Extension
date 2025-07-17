const vscode = require('vscode');

function activate(context) {
    // Registrar ambos comandos
    const schemaDisposable = vscode.commands.registerCommand('schema-path-generator.SchemaPathGenerator', async function () {
        await handlePathGeneration(false);
    });
    
    const formDisposable = vscode.commands.registerCommand('form-path-generator.FormPathGenerator', async function () {
        await handlePathGeneration(true);
    });

    context.subscriptions.push(schemaDisposable, formDisposable);
}

async function handlePathGeneration(isFormPath) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const selection = editor.selection;
    let selectedAttribute = selection.isEmpty ? '' : document.getText(selection);

    if (selectedAttribute) {
        let jsonObject;
        
        if (isFormPath) {
            // Para Form Path, usar el texto original sin modificar
            jsonObject = loadJsonObject(document.getText());
            await findSelectedAttributePaths(jsonObject, selectedAttribute, isFormPath);
        } else {
            // Para Schema Path, agregar ":" temporalmente para la búsqueda
            const range = new vscode.Range(selection.start, selection.end);
            let documentText = document.getText();
            let modifiedText = documentText.substring(0, document.offsetAt(range.start)) + 
                             ":" + selectedAttribute + 
                             documentText.substring(document.offsetAt(range.end));
            jsonObject = loadJsonObject(modifiedText);
            await findSelectedAttributePaths(jsonObject, ":" + selectedAttribute, isFormPath);
        }
    } else {
        // Cuando no hay selección
        let documentText = document.getText();
        let jsonObject = loadJsonObject(documentText);
        await promptForAttributeNameAndHandle(jsonObject, isFormPath);
    }
}

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

        if (currPath.includes(targetPhrase)) {
            result.push(currPath);
        }
    }

    if (data && data.Content) {
        traverse(data.Content, []);
        result = [...new Set(result.reverse())];
    }
    return result;
}

async function findSelectedAttributePaths(jsonObject, selectedAttribute, isFormPath) {
    const searchPhrase = isFormPath ? selectedAttribute.replace(/^:/, '') : selectedAttribute;
    const paths = findPaths(jsonObject, searchPhrase);

    if (paths.length === 0) {
        vscode.window.showInformationMessage(`No attribute found with name: ${selectedAttribute.replace(/^:/, '')}`);
    } else {
        let stringToCopy = isFormPath ? 
            formatFormPath(paths[0]) : 
            formatSchemaPath(paths[0]);

        await vscode.env.clipboard.writeText(stringToCopy);
        vscode.window.showInformationMessage(`Copied to clipboard: ${stringToCopy}`);
    }
}

async function promptForAttributeNameAndHandle(jsonObject, isFormPath) {
    const attributeName = await vscode.window.showInputBox({
        prompt: 'Enter attribute name'
    });

    if (attributeName) {
        const paths = findPaths(jsonObject, attributeName);
        if (paths.length === 0) {
            vscode.window.showInformationMessage(`No attribute found with name: ${attributeName}`);
        } else {
            await displayPaths(paths, isFormPath);
        }
    }
}

async function displayPaths(paths, isFormPath) {
    const pathOptions = paths.map(path => ({
        label: isFormPath ? formatFormPath(path) : formatSchemaPath(path),
        detail: `Click to copy: ${isFormPath ? formatFormPath(path) : formatSchemaPath(path)}`
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

function formatSchemaPath(arr) {
    const cleanPath = arr.map(segment => segment.replace(/^:/, ''));
    return `['${cleanPath.join("']['")}']`;
}

function formatFormPath(arr) {
    const formatSegment = (segment) => {
        const cleanSegment = segment.replace(/^:/, '');
        
        // Si ya está en PascalCase o camelCase, no modificar
        if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(cleanSegment) || 
            /^[a-z]+(?:[A-Z][a-z]+)*$/.test(cleanSegment)) {
            return cleanSegment;
        }
        
        // Formatear segmentos con espacios o guiones
        const words = cleanSegment.split(/[\s-_]+/);
        const capitalized = words.map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
        return capitalized.join('');
    };

    const formattedSegments = arr.map(formatSegment);
    return formattedSegments.join('_');
}

function loadJsonObject(jsonText) {
    try {
        return JSON.parse(jsonText);
    } catch (error) {
        vscode.window.showErrorMessage('Error parsing JSON: ' + error.message);
        return null;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};