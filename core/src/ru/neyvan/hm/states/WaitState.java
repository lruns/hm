package ru.neyvan.hm.states;

import ru.neyvan.hm.game.Symbol;
import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.GiftAndTrap;
import ru.neyvan.hm.surprises.Surprise;

public class WaitState extends State{

    private boolean clicked = false;

    public WaitState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);

    }

    public void click(){
        clicked = true;
        end();
    }

    @Override
    public void end() {
        if(clicked) displayClicked();
        else displayNotClicked();
        clicked = false;
        core.nextState(core.getReactionState(), getLostTime() + core.getGame().getTimeReaction());


    }

    private void displayClicked(){
        Symbol symbol = core.getGame().getSymbol();
        if (symbol.isSurprise()) { //now is not number, it is surprise
            Surprise surprise = symbol.getSurpise();
            if(symbol.isGoodSurprise()){
                core.getGui().congratulation(core.getGame().getTimeReaction()); //player activate a good surprise
                if (surprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(surprise);
                    if(cat.getType() == GiftAndTrap.SUPER_LIFE){
                        core.getGame().increaseLifes(cat.getNumber());
                        core.getGui().updateLife();
                    }else{
                        core.getGame().increaseScore(cat.getNumber());
                        core.getGui().updateScore();
                    }
                }
            }else{
                core.getGui().disgrace(1f); //player activate a bad surprise
                if (surprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(surprise);
                    if(cat.getType() == GiftAndTrap.DEBUF_LIFE){
                        core.getGame().dicreaseLifes(cat.getNumber());
                        core.getGui().updateLife();
                    }else{
                        core.getGame().dicreaseScore(cat.getNumber());
                        core.getGui().updateScore();
                    }
                }
            }
        } else if (core.getGame().checkClick()) {
            //number is pressed by player and number is true => player did correct solution
            core.getGui().congratulation(core.getGame().getTimeReaction());
        } else {
            //number is pressed by player and number is false => player did mistake
            core.getGui().disgrace(core.getGame().getTimeReaction());
            core.getGame().dicreaseLifes(1);
            core.getGui().updateLife();
        }
    }

    private void displayNotClicked() {
        Symbol symbol = core.getGame().getSymbol();
        if (symbol.isSurprise()) { //now is not number, it is surprise
            if(symbol.isGoodSurprise())
                core.getGui().congratulation(core.getGame().getTimeReaction());
            else
                core.getGui().disgrace(core.getGame().getTimeReaction()); //player missed a good surprise
        }else{
            if (!core.getGame().checkClick()) {
                //number is not pressed by player and number is false => player did correct solution
                core.getGui().congratulation(core.getGame().getTimeReaction());
            }else{
                //number is not pressed by player and number is true => player did mistake
                core.getGui().disgrace(core.getGame().getTimeReaction());
                core.getGame().dicreaseLifes(1);
                core.getGui().updateLife();
            }
        }
    }
}