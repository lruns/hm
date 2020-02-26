package ru.neyvan.hm.terms;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class MultiplicationNumerals extends Term {
    private int ideal;
    public MultiplicationNumerals(){super();}
    public MultiplicationNumerals(int ID, int ideal){
        super(ID);
        this.ideal = ideal;
    }
    @Override
    public boolean checkCondition(int numberToCheck) {
        return ideal == MultOfDigits(numberToCheck);
    }
    private int MultOfDigits(int n)
    {
        int m = 1;
        while(n>0)
        {
            m*=n%10;
            n/=10;
        }
        return m;
    }

    public int getIdeal() {
        return ideal;
    }
    //    public static void main (String[] args){
//        System.out.print(MultOfDigits(3513));
//    }
    @Override
    public String printDescription() {
        return HM.game.bundle.format("multiplicationNumerals", ideal);
    }
}
