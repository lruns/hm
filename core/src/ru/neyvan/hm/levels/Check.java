package ru.neyvan.hm.levels;

import java.io.Serializable;
import java.util.List;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.terms.Term;

/**
 * Created by AndyGo on 08.01.2018.
 */

public class Check implements Serializable{
    public static final int AND_OPERATION = 1, OR_OPERATION = 2, NOT_OPERATION = 3;
    private static final int BORDER_ID_CHECK = 97;
    private static final int BORDER_ID_TERM = 122;
    private int ID; //byte 0-10;
    private int typeOfOperation;
    private int idFirstOperand;
    private int idSecondOperand;
    private boolean result;

    public Check(){
        this.ID = 0;
        this.typeOfOperation = 1;
        this.idFirstOperand = 97;
        this.idSecondOperand = 98;
    }
    public Check(int ID, int typeOfOperation, int idFirstOperand, int idSecondOperand){
        this.ID = ID;
        this.typeOfOperation = typeOfOperation;
        this.idFirstOperand = idFirstOperand;
        this.idSecondOperand = idSecondOperand;
    }
    private boolean b1, b2;
    public void makeOperation(List<Term> terms, List<Check> checks, int currentNumber){
        if(idFirstOperand < BORDER_ID_CHECK) b1 = checks.get(idFirstOperand).getResult();
        else b1 = terms.get(idFirstOperand-BORDER_ID_CHECK).checkCondition(currentNumber);

        if(typeOfOperation == NOT_OPERATION){
            result = !b1;
            return;
        }

        if(idSecondOperand < BORDER_ID_CHECK) b2 = checks.get(idSecondOperand).getResult();
        else b2 = terms.get(idSecondOperand-BORDER_ID_CHECK).checkCondition(currentNumber);

        switch (typeOfOperation){
            case AND_OPERATION:
                result = b1 && b2;
                break;
            case OR_OPERATION:
                result = b1 || b2;
                break;
        }
    }
    public boolean getResult(){
        return result;
    }
    public int getID(){
        return ID;
    }

    public int getTypeOfOperation() {
        return typeOfOperation;
    }

    public int getIdFirstOperand() {
        return idFirstOperand;
    }

    public int getIdSecondOperand() {
        return idSecondOperand;
    }

    public String printDescription(List<Term> terms, List<Check> checks) {
        return this.printDescription(terms, checks, 1);
    }

    public String printDescription(List<Term> terms, List<Check> checks, int iteration) {

        if(terms.size() == 1) return terms.get(idFirstOperand-BORDER_ID_CHECK).printDescription();

        String text = new String();
        String text1;
        String text2;
        if(idFirstOperand < BORDER_ID_CHECK) text1 = checks.get(idFirstOperand).printDescription(terms, checks, iteration+1);
        else text1 = terms.get(idFirstOperand-BORDER_ID_CHECK).printDescription();

        if(typeOfOperation == NOT_OPERATION){
            text = HM.game.bundle.format("notOperation", text1);
            return text;
        }

        if(idSecondOperand < BORDER_ID_CHECK) text2 = checks.get(idSecondOperand).printDescription(terms, checks, iteration+1);
        else text2 = terms.get(idSecondOperand-BORDER_ID_CHECK).printDescription();


        if(iteration != 1) text += "(";
        switch (typeOfOperation){
            case AND_OPERATION:
                text = HM.game.bundle.format("andOperation", text1, text2);
                break;
            case OR_OPERATION:
                text = HM.game.bundle.format("orOperation", text1, text2);
                break;
        }
        if(iteration != 1) text += ")";

        return text;
    }
}
