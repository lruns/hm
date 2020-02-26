package ru.neyvan.hm.terms;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 19.01.2018.
 */

public class AdditionNumerals extends Term{
    private int ideal;

    public AdditionNumerals(){super();}
    public AdditionNumerals(int ID, int ideal){
        super(ID);
        this.ideal = ideal;
    }
    @Override
    public boolean checkCondition(int numberToCheck) {
        return ideal == SumOfDigits(numberToCheck);
    }



    private int SumOfDigits (int n)
    {
        int s = 0;
        while (n>0)
        {
            s+=n%10;
            n/=10;
        }
        return s;
    }
    public int getIdeal(){
        return ideal;
    }

    @Override
    public String printDescription() {
        return HM.game.bundle.format("additionNumerals", ideal);
    }
}
