import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
};

const baseUrl = __ENV.BASE_URL ?? 'http://localhost:3000';

export default function () {
  const response = http.get(`${baseUrl}/liveness`);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
