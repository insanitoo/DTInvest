import React from "react";
import { HeadphonesIcon, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { CyberneticBox } from "@/components/ui/cybernetic-box";

export default function ServicePage() {
  return (
    <div className="pb-20">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Serviço</h1>
        <div className="rounded-full bg-white w-10 h-10 flex items-center justify-center">
          <span className="text-dark-secondary text-sm font-bold"></span>
        </div>
      </header>

      <div className="mx-4 mb-6">
        <CyberneticBox className="p-4">
          <h2 className="text-xl font-bold mb-4">Suporte ao Cliente</h2>
          <p className="text-sm text-gray-300 mb-6">
            Nossa equipe de suporte está disponível para ajudar com quaisquer dúvidas ou problemas que você possa ter. 
            Entre em contato por um dos canais abaixo:
          </p>

          <div className="space-y-4">
            <Button 
              variant="default" 
              className="w-full py-6 flex items-center justify-center space-x-2 cyber-element bg-primary text-white"
              onClick={() => window.open("#", "_blank")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              <span>Suporte Online WhatsApp</span>
            </Button>

            <Button 
              variant="default" 
              className="w-full py-6 flex items-center justify-center space-x-2 cyber-element bg-blue-500 text-white"
              onClick={() => window.open("#", "_blank")}
            >
              <Phone className="h-5 w-5 mr-2" />
              <span>Gerente de Contas Telegram</span>
            </Button>

            <Button 
              variant="default" 
              className="w-full py-6 flex items-center justify-center space-x-2 cyber-element bg-blue-600 text-white"
              onClick={() => window.open("#", "_blank")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              <span>Canal Telegram</span>
            </Button>
          </div>
        </CyberneticBox>

        <div className="mt-6">
          <CyberneticBox className="p-4">
            <h2 className="text-xl font-bold mb-2">Horário de Atendimento</h2>
            <p className="text-sm text-gray-300 mb-4">
              Segunda à Segunda: 10:00 - 20:00<br />
              (Todos os dias da semana)
            </p>

            <div className="bg-dark-tertiary p-3 rounded-md border-l-4 border-primary">
              <p className="text-sm">
                Nosso tempo médio de resposta é de 30 minutos durante o horário comercial.
              </p>
            </div>
          </CyberneticBox>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}