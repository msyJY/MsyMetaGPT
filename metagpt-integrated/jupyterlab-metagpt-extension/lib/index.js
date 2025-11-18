import { ICommandPalette } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
/**
 * MetaGPT Widget that contains an iframe to display the MetaGPT frontend
 */
class MetaGPTWidget extends Widget {
    constructor() {
        super();
        this.addClass('jp-metagpt-widget');
        this.id = 'metagpt-widget';
        this.title.label = 'MetaGPT';
        this.title.closable = true;
        this.title.iconClass = 'jp-metagpt-icon';
        // Create iframe element
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'http://localhost:3000'; // MetaGPT frontend URL
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        this.iframe.style.border = 'none';
        this.iframe.allow = 'fullscreen';
        this.node.appendChild(this.iframe);
    }
    /**
     * Handle update requests for the widget.
     */
    onUpdateRequest(msg) {
        super.onUpdateRequest(msg);
    }
    /**
     * Handle resize requests for the widget.
     */
    onResize(msg) {
        super.onResize(msg);
        if (this.iframe) {
            this.iframe.style.width = '100%';
            this.iframe.style.height = '100%';
        }
    }
}
/**
 * Sidebar Widget for MetaGPT button
 */
class MetaGPTSidebarWidget extends Widget {
    constructor(app) {
        super();
        this.addClass('jp-metagpt-sidebar');
        this.id = 'metagpt-sidebar';
        this.title.label = 'MetaGPT';
        this.title.iconClass = 'jp-metagpt-icon';
        this.title.closable = false;
        this.app = app;
        this.createContent();
    }
    createContent() {
        // Create main container
        const container = document.createElement('div');
        container.className = 'jp-metagpt-sidebar-container';
        container.style.padding = '16px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '12px';
        // Create title
        const title = document.createElement('h3');
        title.textContent = 'MetaGPT';
        title.style.margin = '0';
        title.style.fontSize = '16px';
        title.style.fontWeight = 'bold';
        title.style.color = 'var(--jp-ui-font-color1)';
        // Create MetaGPT button
        const button = document.createElement('button');
        button.className = 'jp-metagpt-button';
        button.textContent = '打开 MetaGPT';
        button.title = '在新标签页中打开MetaGPT界面';
        button.style.backgroundColor = '#007ACC';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.padding = '8px 16px';
        button.style.fontSize = '14px';
        button.style.fontWeight = '500';
        button.style.cursor = 'pointer';
        button.style.width = '100%';
        button.style.maxWidth = '180px';
        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#005a9e';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#007ACC';
        });
        // Add click event listener
        button.addEventListener('click', () => {
            this.openMetaGPT();
        });
        // Create description
        const description = document.createElement('p');
        description.textContent = '点击按钮在JupyterLab中打开MetaGPT界面';
        description.style.margin = '0';
        description.style.fontSize = '12px';
        description.style.color = 'var(--jp-ui-font-color2)';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.4';
        container.appendChild(title);
        container.appendChild(button);
        container.appendChild(description);
        this.node.appendChild(container);
    }
    openMetaGPT() {
        // Check if MetaGPT widget already exists
        const widgets = Array.from(this.app.shell.widgets('main'));
        const existingWidget = widgets.find((widget) => widget.id === 'metagpt-widget');
        if (existingWidget) {
            // If exists, activate it
            this.app.shell.activateById('metagpt-widget');
        }
        else {
            // Create new MetaGPT widget
            const widget = new MetaGPTWidget();
            this.app.shell.add(widget, 'main');
            this.app.shell.activateById('metagpt-widget');
        }
    }
}
/**
 * Initialization data for the jupyterlab-metagpt-extension extension.
 */
const plugin = {
    id: 'jupyterlab-metagpt-extension:plugin',
    description: 'A JupyterLab extension to integrate MetaGPT frontend',
    autoStart: true,
    optional: [ICommandPalette],
    activate: (app, palette) => {
        console.log('JupyterLab extension jupyterlab-metagpt-extension is activated!');
        // Create sidebar widget
        const sidebarWidget = new MetaGPTSidebarWidget(app);
        // Add sidebar widget to left area
        app.shell.add(sidebarWidget, 'left', { rank: 200 });
        // Define command
        const command = 'metagpt:open';
        app.commands.addCommand(command, {
            label: '打开 MetaGPT',
            caption: '在新标签页中打开MetaGPT界面',
            execute: () => {
                // Check if MetaGPT widget already exists
                const widgets = Array.from(app.shell.widgets('main'));
                const existingWidget = widgets.find((widget) => widget.id === 'metagpt-widget');
                if (existingWidget) {
                    // If exists, activate it
                    app.shell.activateById('metagpt-widget');
                }
                else {
                    // Create new MetaGPT widget
                    const widget = new MetaGPTWidget();
                    app.shell.add(widget, 'main');
                    app.shell.activateById('metagpt-widget');
                }
            }
        });
        // Add command to palette if available
        if (palette) {
            palette.addItem({ command, category: 'MetaGPT' });
        }
    }
};
export default plugin;
//# sourceMappingURL=index.js.map