export const CommodorePrgServicePath = '/services/commodore-prg';
export const CommodorePrgService = Symbol('CommodorePrgService');

export interface DisassemblePrgRequest {
  resourceUri: string;
}

export interface DisassemblePrgResult {
  resourceUri: string;
  loadAddress: number;
  byteLength: number;
  instructionCount: number;
  text: string;
}

export interface CommodorePrgService {
  disassemble(request: DisassemblePrgRequest): Promise<DisassemblePrgResult>;
}
