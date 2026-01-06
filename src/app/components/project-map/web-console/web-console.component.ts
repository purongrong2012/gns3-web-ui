import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { Node } from '../../../cartography/models/node';
import { Controller } from '@models/controller';
import { NodeConsoleService } from '@services/nodeConsole.service';
import { ThemeService } from '@services/theme.service';
import { HttpClient} from '@angular/common/http';

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-web-console',
  templateUrl: './web-console.component.html',
  styleUrls: ['../../../../../node_modules/xterm/css/xterm.css', './web-console.component.scss'],
})
export class WebConsoleComponent implements OnInit, AfterViewInit {
  @Input() controller: Controller;
  @Input() node: Node;

  public term: Terminal = new Terminal();
  public fitAddon: FitAddon = new FitAddon();
  public isLightThemeEnabled: boolean = false;
  private copiedText: string = '';

  @ViewChild('terminal') terminal: ElementRef;

  constructor(private consoleService: NodeConsoleService, private themeService: ThemeService, private http: HttpClient) {}

  ngOnInit() {
    this.themeService.getActualTheme() === 'light'
      ? (this.isLightThemeEnabled = true)
      : (this.isLightThemeEnabled = false);

    this.consoleService.consoleResized.subscribe((ev) => {
      let numberOfColumns = Math.floor(ev.width / 9);
      let numberOfRows = Math.floor(ev.height / 17);

      this.consoleService.setNumberOfColumns(numberOfColumns);
      this.consoleService.setNumberOfRows(numberOfRows);

      this.term.resize(numberOfColumns, numberOfRows);
    });

    if (this.consoleService.getNumberOfColumns() && this.consoleService.getNumberOfRows()) {
      this.term.resize(this.consoleService.getNumberOfColumns(), this.consoleService.getNumberOfRows());
    }
  }

  async ngAfterViewInit() {
    this.term.open(this.terminal.nativeElement);
    if (this.isLightThemeEnabled)
      this.term.setOption('theme', { background: 'white', foreground: 'black', cursor: 'black' });

      this.consoleService.getUrl(this.controller, this.node).subscribe({
        next: (url: string) => {
          console.log('WebSocket URL:', url);
          // 创建WebSocket连接
          const socket = new WebSocket(url);
          socket.onerror = (event) => {
            this.term.write('Connection lost');
          };
          socket.onclose = (event) => {
            this.consoleService.closeConsoleForNode(this.node);
          };

          const attachAddon = new AttachAddon(socket);
          this.term.loadAddon(attachAddon);
          this.term.setOption('cursorBlink', true);
          this.term.loadAddon(this.fitAddon);
          this.fitAddon.activate(this.term);
          this.term.focus();
          // 添加终端数据事件监听，将终端内容写给后台
          this.term.onData((val) => {
            const msg = JSON.stringify({
              "type": "terminal_write",
              "detail": {
                "name": this.node.name,
                "data": val
              }
            });
            if (socket.readyState === 1) { // WebSocket.OPEN 状态为1，表示连接已建立
              socket.send(msg);
            }
          });
          this.term.attachCustomKeyEventHandler((key: KeyboardEvent) => {
            if (key.code === 'KeyC' || key.code === 'KeyV') {
              if (key.ctrlKey && key.shiftKey) {
                return false;
              }
            }
            return true;
          });
        },
        error: (err) => {
          console.error('Error getting WebSocket URL:', err.message);
          // 显示用户友好的错误消息
        }
      });
  }
}
