import { EventEmitter, Injectable } from '@angular/core';
import { Controller } from '@models/controller';
import { Subject } from 'rxjs';
import { Node } from '../cartography/models/node';
import { Router, ActivatedRoute } from '@angular/router';
import { ToasterService } from './toaster.service';
import { MapSettingsService } from './mapsettings.service';
import { node } from 'prop-types';
import { environment } from 'environments/environment';
import { HttpClient } from '@angular/common/http';
import { Project } from '@models/project';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class NodeConsoleService {
  public nodeConsoleTrigger = new EventEmitter<Node>();
  public closeNodeConsoleTrigger = new Subject<Node>();
  public consoleResized = new Subject<ConsoleResizedEvent>();
  public openConsoles: number = 0;

  public readonly defaultConsoleWidth = 720;
  public readonly defaultConsoleHeight = 408;

  public readonly defaultNumberOfColumns = 80;
  public readonly defaultNumberOfRows = 24;

  private lastNumberOfColumns: number;
  private lastNumberOfRows: number;

  constructor(
    private router: Router,
    private toasterService: ToasterService,
    private mapSettingsService: MapSettingsService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  getNumberOfColumns() {
    return this.lastNumberOfColumns;
  }

  getNumberOfRows() {
    return this.lastNumberOfRows;
  }

  setNumberOfColumns(value: number) {
    this.lastNumberOfColumns = value;
  }

  setNumberOfRows(value: number) {
    this.lastNumberOfRows = value;
  }

  openConsoleForNode(node: Node) {
    this.nodeConsoleTrigger.emit(node);
  }

  closeConsoleForNode(node: Node) {
    this.closeNodeConsoleTrigger.next(node);
  }

  resizeTerminal(event: ConsoleResizedEvent) {
    this.consoleResized.next(event);
  }

  getLineWidth() {
    return this.defaultConsoleWidth / this.defaultNumberOfColumns;
  }

  getLineHeight() {
    return this.defaultConsoleHeight / this.defaultNumberOfRows;
  }

 getUrl(controller: Controller, node: Node): Observable<string> {
    let projectName = "";
    this.route.queryParams.subscribe(params => {
      projectName = params['projectName'];
    });
    // 1. 项目名称前缀校验
    if (!projectName.startsWith('topo-scriptgen--')) {
      // 使用throwError抛出错误而不是alert
      return throwError(() => new Error('This feature is only available for Topo Manager projects.'));
    }

    // 2. 发起HTTP GET请求并处理响应
    return this.http.get<any>(
      `https://${projectName}.coder-open.h3c.com/api/v1/physical-devices`
    ).pipe(
      map(response => {
        // 3. 检查部署状态
        if (response.deployStatus !== 'deployed') {
          throw new Error(`Project deployment status is not 'deployed'. Current status: ${response.deployStatus}`);
        }

        // 4. 在device_list中查找与传入node.name匹配的设备
        const deviceList = response.data?.device_list || [];
        const currentNode = deviceList.find((device: any) => device.name === node.name);

        if (!currentNode) {
          throw new Error(`Device with name "${node.name}" not found in the physical-devices list.`);
        }

        // 5. 根据controller协议确定WebSocket协议
        let protocol: string = "ws";
        if (controller.protocol === "https:") {
          protocol = "wss";
        }

        // 6. 使用匹配到的设备信息构造并返回WebSocket URL字符串
        return `${protocol}://topo-executors.coder-open.h3c.com/${currentNode.executorip}?terminal=${currentNode.title}`;
      }),
      // 错误处理
      catchError(error => {
        console.error('Failed to get WebSocket URL:', error);
        return throwError(() => error);
      })
    );
  }
  
  openConsolesForAllNodesInWidget(nodes: Node[]) {
    let nodesToStart = 'Please start the following nodes if you want to open consoles for them: ';
    let nodesToStartCounter = 0;
    nodes.forEach((n) => {
      if (n.console_type !== "none") {
        if (n.status === 'started') {
          this.mapSettingsService.logConsoleSubject.next(true);
          // this timeout is required due to xterm.js implementation
          setTimeout(() => { this.openConsoleForNode(n); }, 500);
        } else {
          nodesToStartCounter++;
          nodesToStart += n.name + ' '
        }
      }
    });
    if (nodesToStartCounter > 0) {
      this.toasterService.error(nodesToStart);
    }
  }

  openConsolesForAllNodesInNewTabs(nodes: Node[]) {
    let nodesToStart = 'Please start the following nodes if you want to open consoles in tabs for them: ';
    let nodesToStartCounter = 0;
    nodes.forEach((n) => {
      // opening a console in tab is only supported for telnet type
      if (n.console_type === "telnet") {
        if (n.status === 'started') {
          let url = this.router.url.split('/');
          let urlString = `/static/web-ui/${url[1]}/${url[2]}/${url[3]}/${url[4]}/nodes/${n.node_id}`;
          window.open(urlString);
        } else {
          nodesToStartCounter++;
          nodesToStart += n.name + ' '
        }
      }
    });
    if (nodesToStartCounter > 0) {
      this.toasterService.error(nodesToStart);
    }
  }
}

export interface ConsoleResizedEvent {
  width: number;
  height: number;
}
