import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

interface LineCountSettings {
  label: string;
}

const DEFAULT_SETTINGS: LineCountSettings = {
  label: 'lines',
};

export default class LineCountPlugin extends Plugin {
  private statusEl: HTMLElement | null = null;
  settings: LineCountSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    this.statusEl = this.addStatusBarItem();
    const updateLineCount = () => this.refreshStatusBar();

    const ext = ViewPlugin.fromClass(
      class {
        view: EditorView;
        constructor(view: EditorView) { this.view = view; updateLineCount(); }
        update(update: ViewUpdate) { if (update.docChanged) updateLineCount(); }
      }
    );

    this.registerEditorExtension(ext);

    // workspace editor-change as a fallback (some environments debounce)
    this.registerEvent(this.app.workspace.on('editor-change', () => updateLineCount()));

    // also update when active leaf changes
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => updateLineCount()));

    this.addSettingTab(new LineCountSettingTab(this.app, this));

    updateLineCount();
  }

  onunload() {
    if (this.statusEl) this.statusEl.remove();
  }

  private getLabel(): string {
    const customLabel = this.settings.label?.trim();
    return customLabel || DEFAULT_SETTINGS.label;
  }

  private refreshStatusBar = () => {
    const mv = this.app.workspace.getActiveViewOfType(MarkdownView);
    const label = this.getLabel();
    if (!mv || !this.statusEl) return;
    const editorWithView = mv.editor as Editor & { cm?: EditorView; view?: EditorView };
    const editorView = editorWithView.cm ?? editorWithView.view;
    if (editorView?.state.doc) {
      const lines = editorView.state.doc.toString().split(/\r\n|\r|\n/).length;
      this.statusEl.setText(`${lines} ${label}`);
      return;
    }
    // fallback using the simple Editor API
    try {
      const lines = mv.editor ? mv.editor.lineCount() : 0;
      this.statusEl.setText(`${lines} ${label}`);
    } catch {
      this.statusEl.setText('');
    }
  };

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshStatusBar();
  }
}

class LineCountSettingTab extends PluginSettingTab {
  plugin: LineCountPlugin;

  constructor(app: App, plugin: LineCountPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Status bar display')
      .setHeading();

    new Setting(containerEl)
      .setName('Displayed text')
      .setDesc('Optional text after the count')
      .addText((text) => text
        .setPlaceholder(DEFAULT_SETTINGS.label)
        .setValue(this.plugin.settings.label)
        .onChange(async (value) => {
          this.plugin.settings.label = value.trim() || DEFAULT_SETTINGS.label;
          await this.plugin.saveSettings();
        }));
  }
}
