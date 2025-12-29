import { 
  Component, 
  OnInit, 
  Inject  // 添加 Inject 导入
} from '@angular/core';
import { 
  UntypedFormBuilder, 
  UntypedFormControl, 
  UntypedFormGroup, 
  Validators 
} from '@angular/forms';
import { 
  MatDialogRef, 
  MAT_DIALOG_DATA  // 确保正确导入
} from '@angular/material/dialog';
import { Node } from '../../../cartography/models/node';
import { Controller } from '@models/controller';
import { Project } from '@models/project';
import { NodeService } from '@services/node.service';
import { ToasterService } from '@services/toaster.service';
import { HttpClient } from '@angular/common/http';

// 定义对话框数据的接口
export interface DialogData {
  controller: Controller;
  project: Project;
  node?: Node; // 可选，如果你也需要传递节点
}

@Component({
  selector: 'app-deploy-dialog', // 确保选择器正确
  templateUrl: './deploy-dialog.component.html',
  styleUrls: ['./deploy-dialog.component.scss'],
})
export class DeployDialogComponent implements OnInit {
  controller: Controller;
  project: Project;
  node?: Node; // 可选
  inputForm: UntypedFormGroup;

  constructor(
    public dialogRef: MatDialogRef<DeployDialogComponent>,
    public nodeService: NodeService,
    private toasterService: ToasterService,
    private formBuilder: UntypedFormBuilder,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: DialogData // 正确注入对话框数据
  ) {
    // 从 data 中获取传递的参数
    this.controller = data.controller;
    this.project = data.project;
    this.node = data.node; // 如果有的话
    
    this.inputForm = this.formBuilder.group({
      versionPath: new UntypedFormControl('', Validators.required),
      deviceType: new UntypedFormControl('', Validators.required)
    });
  }

  ngOnInit() {
    // 如果你需要获取节点信息，可以在这里调用
    // 注意：这里需要确保 this.node 已经被传递或者在 data 中可用
    if (this.node) {
      this.nodeService.getNode(this.controller, this.node).subscribe((node: Node) => {
        this.node = node;
      });
    }
  }

  onSaveClick() {
    if (this.inputForm.valid) {
      const deployData = {
        versionPath: this.inputForm.value.versionPath,
        deviceType: this.inputForm.value.deviceType,
        // 如果需要，可以添加其他数据
        // controller: this.controller,
        // project: this.project
      };
      if (!this.project.name.startsWith('topo-manager--')) {
        alert('This feature is only available for Topo Manager projects.');
        return;
      }
      // 使用正确的 URL
      let projectName = this.project.name.split('topo-manager--')[1]
      const url = `https://8000--main--${projectName}.coder-open.h3c.com/api/v1/deploy`;
      
      this.http.post(url, deployData).subscribe({
        next: () => {
          this.toasterService.success('Deployment request sent successfully.');
          this.dialogRef.close(true); // 传递结果
        },
        error: (error) => {
          this.toasterService.error(`Deployment failed: ${error.message}`);
        }
      });
    } else {
      this.toasterService.error('Fill all required fields.');
    }
  }

  onCancelClick() {
    this.dialogRef.close(false); // 传递取消结果
  }
}