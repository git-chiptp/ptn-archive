import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.startsWith('http://localhost:8080/api/')) {
    request = request.clone({ withCredentials: true });
  }
  return next(request);
};
