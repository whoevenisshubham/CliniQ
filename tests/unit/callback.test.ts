import { afterEach,expect,it,vi } from "vitest";
import { validateCallback } from "@/lib/server/auth/callback";

afterEach(()=>vi.unstubAllEnvs());
it.each(["https://attacker.invalid","http://localhost:3001"])("rejects callback from %s",origin=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 expect(()=>validateCallback(new Request(origin+"/auth/callback?code=synthetic"))).toThrow("origin");
});
it.each(["https://attacker.invalid","//attacker.invalid","/doctor/../admin","/patient?token=x","/patient%0d%0aLocation:bad"])("rejects return path %s",next=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 expect(()=>validateCallback(new Request("http://localhost:3000/auth/callback?code=synthetic&next="+encodeURIComponent(next)))).toThrow("return path");
});
it.each(["","?code=","?code=a&code=b","?code=a&error=denied"])("rejects unusable callback %s",query=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 expect(()=>validateCallback(new Request("http://localhost:3000/auth/callback"+query))).toThrow("could not be completed");
});
it("accepts only an exact allowlisted relative return",()=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 expect(validateCallback(new Request("http://localhost:3000/auth/callback?code=synthetic&next=/patient/reports"))).toEqual({code:"synthetic",next:"/patient/reports"});
});
