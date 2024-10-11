// This plugin will duplicate the selected object based on user input.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

type Vector2 = {
    x: number;
    y: number;
}

type q<T> = T | undefined

type Message = {
    type: 'create' | 'cancel';
    
    count: q<number>;
    radius: q<number>;
    radOffset: q<number>;
}

const DEG_TO_RAD = Math.PI / 180;

const getPositionAroundCircle = (center: Vector2, radius: number, angle: number): Vector2 => {
    const angleRadian = angle * DEG_TO_RAD;
    return {
        x: center.x + radius * Math.cos(angleRadian),
        y: center.y + radius * Math.sin(angleRadian)
    };
}

// stole this from github somewhere, can't find source.
function setRotation(node: any, angle: number){
    let { x, y, width, height, rotation } = node;
  
    const theta = angle * DEG_TO_RAD;
    const originTheta = rotation * DEG_TO_RAD;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
  
    const originX = (-Math.cos(originTheta) * x + y * -Math.sin(originTheta) - centerY * -Math.sin(originTheta) - centerX * -Math.cos(originTheta) + centerX) - width;
    const originY = (Math.sin(originTheta) * x + centerX * -Math.sin(originTheta) + y * -Math.cos(originTheta) - centerY * -Math.cos(originTheta) + centerY) - height;
  
    const originCenterX = originX + width / 2;
    const originCenterY = originY + height / 2;
    
    const newX = (Math.cos(theta) * originX + originY * Math.sin(theta) - originCenterY * Math.sin(theta) - originCenterX * Math.cos(theta) + originCenterX);
    const newY = (-Math.sin(theta) * originX + originCenterX * Math.sin(theta) + originY * Math.cos(theta) - originCenterY * Math.cos(theta) + originCenterY);
  
    const transform = [
      [Math.cos(theta), Math.sin(theta), newX],
      [-Math.sin(theta), Math.cos(theta), newY]
    ];
    
    node.relativeTransform = transform;
}

function getSelectionCenter(selection: readonly BaseNode[]): Vector2 {
    if (selection.length === 0) throw new Error("selection is empty."); 

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selection.forEach(node => {
        if ("x" in node && "y" in node) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + (node.width || 0));
            maxY = Math.max(maxY, node.y + (node.height || 0));
        }
    });

    return {
        x: (minX + maxX) / 2,
        y:  (minY + maxY) / 2
    };
}

const messages: Record<Message['type'], (msg: Message) => void> = {
    "create": (msg) => {
        if (!msg.radius) return figma.notify('radius is unset or 0.');
        if (!msg.count) return figma.notify('count is unset or 0.');;
        if (msg.radOffset === undefined) return;

        const selection = figma.currentPage.selection;
        
        if (selection.length === 0) {
            figma.closePlugin("no object selected.");
            return;
        }

        const primarySelectionObj = selection[0];

        const offset: number = msg.radOffset;
        const center: Vector2 = {
            x: primarySelectionObj.x,
            y: primarySelectionObj.y
        };
        const angleIncrement = (360 / msg.count) + msg.radOffset;

        const objs: SceneNode[] = [];

        for (let i = 0; i < msg.count; i++) {
            const angle = i * angleIncrement;
            const position = getPositionAroundCircle(center, msg.radius, angle);
            selection.forEach(obj => {
                const clone = obj.clone();
                // set position to parent, so positioning is relative.
                (primarySelectionObj.parent || figma.currentPage).appendChild(clone);
                
                clone.x = position.x;
                clone.y = position.y;

                setRotation(clone, -angle + offset);

                objs.push(clone);
            });
        }

        // group and set parent (again).
        figma.group(objs, primarySelectionObj.parent || figma.currentPage);
        figma.notify("sucessfully created object.")
    },

    "cancel": () => {
        figma.closePlugin("canceled.");
    }
}

figma.ui.onmessage = (msg: Message) => {
    const action = messages[msg.type];

    if (action) {
        try {
            action(msg); 
        } catch (err) {
            console.warn(err);
        }
    } else {
        figma.notify("no action found.");
    }
}