import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Controller, ControllerProtocol } from '@models/controller';
import { ControllerService } from '@services/controller.service';
import { LoginService } from '@services/login.service';

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(
    private controllerService: ControllerService,
    private loginService: LoginService,
    private router: Router
  ) {}

  async canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const controller_id = next.paramMap.get('controller_id');
    this.loginService.controller_id = controller_id;
    let controller = await this.controllerService.get(parseInt(controller_id, 10));

    // If the controller entry doesn't exist yet (deep-link first load), bootstrap a default one.
    if (!controller && controller_id === '1') {
      controller = new Controller();
      controller.id = parseInt(controller_id, 10);
      controller.name = 'local';
      controller.host = location.hostname;
      controller.protocol = location.protocol as ControllerProtocol;
      controller.port = location.port ? parseInt(location.port, 10) : controller.protocol === 'https:' ? 443 : 80;
      controller.location = 'bundled';
      controller.tokenExpired = true;
      await this.controllerService.create(controller);
    }

    const injectedToken = next.queryParamMap.get('token');
    const username = next.queryParamMap.get('username');
    const password = next.queryParamMap.get('password');
    if (injectedToken) {
      // Allow token injection via query param for automation flows (e.g., deep links that carry JWT tokens).
      controller.authToken = injectedToken;
      controller.tokenExpired = false;
      await this.controllerService.update(controller);
    } else {
      // Allow auto-login via query params: username/password.
      if (username && password) {
        try {
          const auth = await this.loginService.login(controller, username, password).toPromise();
          controller.authToken = auth.access_token;
          controller.tokenExpired = false;
          await this.controllerService.update(controller);
        } catch (e) {
          controller.tokenExpired = true;
          await this.controllerService.update(controller);
        }
      }
    }

    try {
      await this.loginService.getLoggedUser(controller);
    } catch (e) {
      controller.tokenExpired = true;
      await this.controllerService.update(controller);
    }

    return this.controllerService.get(parseInt(controller_id, 10)).then((updated: Controller) => {
      if (updated.authToken && !updated.tokenExpired) {
        return true;
      }
      this.router.navigate(['/controller', updated.id, 'login'], { queryParams: { returnUrl: state.url } });
    });
  }
}
